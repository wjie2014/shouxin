package com.shouxin.qa.statistics;

import com.shouxin.qa.auth.AuthUser;
import com.shouxin.qa.auth.AuthUserService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.LinkedHashMap;
import java.util.Map;
import java.time.Duration;
import java.time.LocalDate;
import java.sql.Timestamp;
import java.util.List;

@RestController
@RequestMapping("/api/statistics")
public class DashboardController {
    private final JdbcTemplate jdbc;
    private final AuthUserService users;
    public DashboardController(JdbcTemplate jdbc,AuthUserService users) { this.jdbc = jdbc;this.users=users; }

    @GetMapping("/dashboard")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> dashboard(Authentication authentication) {
        AuthUser current=users.findByUsername(authentication.getName());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", count("SELECT COUNT(*) FROM qa_pair WHERE deleted = 0"));
        result.put("published", count("SELECT COUNT(*) FROM qa_pair WHERE deleted = 0 AND status = 'published'"));
        result.put("pendingReview", count("SELECT COUNT(*) FROM qa_pair WHERE deleted = 0 AND status LIKE 'pending_review_%'"));
        result.put("draft", count("SELECT COUNT(*) FROM qa_pair WHERE deleted = 0 AND status = 'draft'"));
        result.put("retired", count("SELECT COUNT(*) FROM qa_pair WHERE deleted = 0 AND status = 'retired'"));
        result.put("thisMonthNew", count("SELECT COUNT(*) FROM qa_pair WHERE deleted = 0 AND created_at >= ADD_MONTHS(CURRENT_TIMESTAMP, -1)"));
        List<Map<String,Object>> reviewTimes=jdbc.queryForList("SELECT submitted_at,published_at FROM qa_pair_version WHERE submitted_at IS NOT NULL AND published_at IS NOT NULL");
        double avg=reviewTimes.stream().mapToDouble(r->{Object s=r.get("SUBMITTED_AT");Object e=r.get("PUBLISHED_AT");if(s instanceof Timestamp st&&e instanceof Timestamp et)return Duration.between(st.toInstant(),et.toInstant()).toMinutes()/60.0;return 0;}).average().orElse(0);
        result.put("avgReviewHours", Math.round(avg*100.0)/100.0);
        result.put("statusDistribution", jdbc.queryForList("SELECT status, COUNT(*) AS count FROM qa_pair WHERE deleted = 0 GROUP BY status ORDER BY status"));
        result.put("domainDistribution", jdbc.queryForList("SELECT d.domain_name, COUNT(p.id) AS count FROM qa_domain d LEFT JOIN qa_pair p ON p.domain_l1_id = d.id AND p.deleted = 0 WHERE d.level_no = 1 AND d.deleted = 0 GROUP BY d.domain_name, d.sort_order ORDER BY d.sort_order"));
        result.put("unitRanking",jdbc.queryForList("SELECT NVL(u.unit_name,'未分配单位') unit_name,COUNT(p.id) count FROM qa_pair p LEFT JOIN sys_unit u ON u.id=p.unit_id WHERE p.deleted=0 GROUP BY u.unit_name ORDER BY count DESC LIMIT 10"));
        result.put("reviewPassRate",jdbc.queryForList("SELECT level_no,COUNT(*) total_count,SUM(CASE WHEN result='pass' THEN 1 ELSE 0 END) pass_count,ROUND(SUM(CASE WHEN result='pass' THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(*),0),2) pass_rate FROM qa_review_record GROUP BY level_no ORDER BY level_no"));
        result.put("versionStats",jdbc.queryForMap("SELECT COUNT(*) pair_count,SUM(CASE WHEN version_count>1 THEN 1 ELSE 0 END) updated_pair_count,SUM(CASE WHEN version_count>1 THEN version_count-1 ELSE 0 END) update_count,MAX(version_count) max_versions FROM (SELECT v.qa_pair_id,COUNT(*) version_count FROM qa_pair_version v JOIN qa_pair p ON p.id=v.qa_pair_id WHERE p.deleted=0 GROUP BY v.qa_pair_id) t"));
        result.put("todos",Map.of(
                "myPending",count("SELECT COUNT(*) FROM qa_pair WHERE deleted=0 AND author_id='"+safeId(current.id())+"' AND status LIKE 'pending_review_%'"),
                "myRejected",count("SELECT COUNT(*) FROM qa_pair WHERE deleted=0 AND author_id='"+safeId(current.id())+"' AND status LIKE 'rejected_%'"),
                "myUpdating",count("SELECT COUNT(*) FROM qa_pair WHERE deleted=0 AND author_id='"+safeId(current.id())+"' AND status='updating'"),
                "pendingForMe",jdbc.queryForObject("SELECT COUNT(*) FROM qa_review_task WHERE reviewer_id=? AND task_status='pending'",Integer.class,current.id())
        ));
        return result;
    }

    @GetMapping("/trend")
    @PreAuthorize("isAuthenticated()")
    public Map<String,Object> trend(@RequestParam(defaultValue="30") int days) {
        int safeDays=Math.min(Math.max(days,1),90);
        List<Map<String,Object>> source=jdbc.queryForList("SELECT TO_CHAR(created_at,'YYYY-MM-DD') day, COUNT(*) count FROM qa_pair WHERE deleted=0 AND created_at>=ADD_DAYS(CURRENT_TIMESTAMP,?) GROUP BY TO_CHAR(created_at,'YYYY-MM-DD') ORDER BY day",-(safeDays-1));
        Map<String,Integer> counts=new LinkedHashMap<>();for(Map<String,Object> row:source){Object day=row.getOrDefault("DAY",row.get("day"));Object value=row.getOrDefault("COUNT",row.get("count"));counts.put(String.valueOf(day),value instanceof Number n?n.intValue():0);}
        List<Map<String,Object>> items=new java.util.ArrayList<>();LocalDate start=LocalDate.now().minusDays(safeDays-1L);for(int i=0;i<safeDays;i++){String day=start.plusDays(i).toString();items.add(Map.of("day",day,"count",counts.getOrDefault(day,0)));}
        return Map.of("days",safeDays,"items",items);
    }

    @PostMapping("/custom")
    @PreAuthorize("isAuthenticated()")
    public Map<String,Object> custom(@RequestBody CustomRequest request) {
        String dimension=Map.of("status","p.status","domainL1","d.domain_name","author","u.real_name").getOrDefault(request.dimension(),"p.status");
        String sql="SELECT "+dimension+" label, COUNT(*) count FROM qa_pair p JOIN sys_user u ON u.id=p.author_id JOIN qa_domain d ON d.id=p.domain_l1_id WHERE p.deleted=0 GROUP BY "+dimension+" ORDER BY count DESC";
        return Map.of("dimension",request.dimension(),"metric",request.metric()==null?"count":request.metric(),"items",jdbc.queryForList(sql));
    }
    @GetMapping(value="/custom/export", produces="text/csv;charset=UTF-8")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<String> customExport(@RequestParam(defaultValue="status") String dimension) {
        String expression=Map.of("status","p.status","domainL1","d.domain_name","author","u.real_name").getOrDefault(dimension,"p.status");
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT "+expression+" label, COUNT(*) count FROM qa_pair p JOIN sys_user u ON u.id=p.author_id JOIN qa_domain d ON d.id=p.domain_l1_id WHERE p.deleted=0 GROUP BY "+expression+" ORDER BY count DESC");
        StringBuilder csv=new StringBuilder("维度,数量\n");
        for(Map<String,Object> row:rows){String label=String.valueOf(row.getOrDefault("LABEL",row.getOrDefault("label",""))).replace("\"","\"\"");Object count=row.getOrDefault("COUNT",row.getOrDefault("count",0));csv.append('"').append(label).append("\",\"").append(count).append("\"\n");}
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=custom-analysis.csv").contentType(MediaType.parseMediaType("text/csv;charset=UTF-8")).body("\uFEFF"+csv);
    }
    public record CustomRequest(String dimension,String metric,String from,String to) {}

    private int count(String sql) { Integer n = jdbc.queryForObject(sql, Integer.class); return n == null ? 0 : n; }
    private String safeId(String value){if(value==null||!value.matches("[A-Za-z0-9_-]{1,64}"))throw new IllegalArgumentException("用户标识无效");return value;}
}
