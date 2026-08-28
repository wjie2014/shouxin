package com.shouxin.qa.statistics;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.LinkedHashMap;
import java.util.Map;
import java.time.Duration;
import java.sql.Timestamp;
import java.util.List;

@RestController
@RequestMapping("/api/statistics")
public class DashboardController {
    private final JdbcTemplate jdbc;
    public DashboardController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping("/dashboard")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> dashboard() {
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
        return result;
    }

    @GetMapping("/trend")
    @PreAuthorize("isAuthenticated()")
    public Map<String,Object> trend(@RequestParam(defaultValue="30") int days) {
        int safeDays=Math.min(Math.max(days,1),90);
        return Map.of("days",safeDays,"items",jdbc.queryForList("SELECT TO_CHAR(created_at,'YYYY-MM-DD') day, COUNT(*) count FROM qa_pair WHERE deleted=0 AND created_at>=ADD_DAYS(CURRENT_TIMESTAMP,?) GROUP BY TO_CHAR(created_at,'YYYY-MM-DD') ORDER BY day",-safeDays));
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
}
