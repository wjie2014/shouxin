package com.shouxin.qa.review;

import com.shouxin.qa.auth.AuthUser;
import com.shouxin.qa.auth.AuthUserService;
import com.shouxin.qa.audit.OperationLogService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.*;

@RestController
@RequestMapping("/api/reviews")
public class ReviewController {
    private final JdbcTemplate jdbc;
    private final AuthUserService users;
    private final OperationLogService logs;
    private final ReviewWorkflow workflow;

    public ReviewController(JdbcTemplate jdbc, AuthUserService users, OperationLogService logs, ReviewWorkflow workflow) {
        this.jdbc = jdbc;
        this.users = users;
        this.logs = logs;
        this.workflow = workflow;
    }

    @GetMapping("/pending")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> pending(@RequestParam(defaultValue = "1") int level, @RequestParam(defaultValue = "1") int page,
                                       @RequestParam(defaultValue = "10") int pageSize,
                                       @RequestParam(required=false) String keyword,@RequestParam(required=false) String submitter,
                                       @RequestParam(required=false) String domainL1Id,@RequestParam(required=false) String domainL2Id,@RequestParam(required=false) String domainL3Id,
                                       @RequestParam(required=false) String submitFrom,@RequestParam(required=false) String submitTo,
                                       @RequestParam(defaultValue="assignedAt") String sortBy,@RequestParam(defaultValue="asc") String sortDir,
                                       Authentication authentication) {
        if (level < 1 || level > 3) throw new IllegalArgumentException("审核级别必须为1、2或3");
        page = Math.max(page, 1); pageSize = Math.max(1, Math.min(pageSize, 100));
        AuthUser user = users.findByUsername(authentication.getName());
        String status = "pending_review_l" + level;
        StringBuilder sql = new StringBuilder("SELECT p.id,p.qa_code,p.status,p.updated_at,v.question_text,v.submitted_at,u.real_name,d1.domain_name domain_l1_name,d2.domain_name domain_l2_name,d3.domain_name domain_l3_name,rt.assigned_at FROM qa_pair p JOIN qa_pair_version v ON v.id=p.current_version_id JOIN sys_user u ON u.id=p.author_id JOIN qa_domain d1 ON d1.id=p.domain_l1_id JOIN qa_domain d2 ON d2.id=p.domain_l2_id LEFT JOIN qa_domain d3 ON d3.id=p.domain_l3_id JOIN qa_review_task rt ON rt.version_id=p.current_version_id AND rt.level_no=? AND rt.reviewer_id=? AND rt.task_status='pending' WHERE p.deleted=0 AND p.status=?");
        List<Object> args = new ArrayList<>(List.of(level, user.id(), status));
        if(keyword!=null&&!keyword.isBlank()){sql.append(" AND (p.qa_code LIKE ? OR v.question_text LIKE ? OR v.answer_text LIKE ?)");String like="%"+keyword.trim()+"%";args.add(like);args.add(like);args.add(like);}
        if(submitter!=null&&!submitter.isBlank()){sql.append(" AND u.real_name LIKE ?");args.add("%"+submitter.trim()+"%");}
        if(domainL1Id!=null&&!domainL1Id.isBlank()){sql.append(" AND p.domain_l1_id=?");args.add(domainL1Id);}
        if(domainL2Id!=null&&!domainL2Id.isBlank()){sql.append(" AND p.domain_l2_id=?");args.add(domainL2Id);}
        if(domainL3Id!=null&&!domainL3Id.isBlank()){sql.append(" AND p.domain_l3_id=?");args.add(domainL3Id);}
        if(submitFrom!=null&&!submitFrom.isBlank()){sql.append(" AND v.submitted_at>=TO_TIMESTAMP(?,'YYYY-MM-DD HH24:MI:SS')");args.add(submitFrom+" 00:00:00");}
        if(submitTo!=null&&!submitTo.isBlank()){sql.append(" AND v.submitted_at<=TO_TIMESTAMP(?,'YYYY-MM-DD HH24:MI:SS')");args.add(submitTo+" 23:59:59");}
        Integer total = jdbc.queryForObject("SELECT COUNT(*) FROM (" + sql + ") t", Integer.class, args.toArray());
        String order=Map.of("assignedAt","rt.assigned_at","code","p.qa_code","submitter","u.real_name","submittedAt","v.submitted_at").getOrDefault(sortBy,"rt.assigned_at");
        sql.append(" ORDER BY ").append(order).append("desc".equalsIgnoreCase(sortDir)?" DESC":" ASC").append(" LIMIT ? OFFSET ?"); args.add(pageSize); args.add((page - 1) * pageSize);
        return Map.of("items", jdbc.queryForList(sql.toString(), args.toArray()), "total", total == null ? 0 : total, "page", page, "pageSize", pageSize, "level", level);
    }

    @PostMapping("/{qaPairId}/decision")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public Map<String, Object> decide(@PathVariable String qaPairId, @Valid @RequestBody DecisionRequest request, Authentication authentication) {
        AuthUser reviewer = users.findByUsername(authentication.getName());
        String result = request.result().trim().toLowerCase(Locale.ROOT);
        if (!Set.of("pass", "reject").contains(result)) throw new IllegalArgumentException("审核结果只能是pass或reject");
        Map<String, Object> pair = jdbc.queryForList("SELECT status FROM qa_pair WHERE id = ? AND deleted = 0", qaPairId).stream().findFirst().orElseThrow(() -> new NoSuchElementException("问答对不存在"));
        String status = String.valueOf(pair.get("status"));
        int level = switch (status) { case "pending_review_l1" -> 1; case "pending_review_l2" -> 2; case "pending_review_l3" -> 3; default -> 0; };
        if (level == 0) throw new IllegalArgumentException("当前状态不在审核流程中");
        if ("reject".equals(result) && (request.opinion() == null || request.opinion().isBlank())) throw new IllegalArgumentException("驳回时必须填写审核意见");
        String nextStatus = workflow.decide(qaPairId, reviewer.id(), result, request.opinion(), request.suggestion());
        logs.record(reviewer.id(), "REVIEW_QA_PAIR", request.result() + " level=" + level, "QA_PAIR", qaPairId);
        return Map.of("qaPairId", qaPairId, "level", level, "result", request.result(), "status", nextStatus);
    }

    @GetMapping("/my-summary")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> mySummary(Authentication authentication) {
        AuthUser user = users.findByUsername(authentication.getName());
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT t.level_no, COUNT(*) AS task_count, MIN(t.assigned_at) AS oldest_assigned_at
                  FROM qa_review_task t
                  JOIN qa_pair_version v ON v.id = t.version_id
                  JOIN qa_pair p ON p.id = v.qa_pair_id AND p.current_version_id = v.id
                 WHERE t.reviewer_id = ? AND t.task_status = 'pending' AND p.deleted = 0
                 GROUP BY t.level_no ORDER BY t.level_no
                """, user.id());
        Map<Integer, Integer> byLevel = new LinkedHashMap<>();
        Object oldest = null;
        int total = 0;
        for (Map<String, Object> row : rows) {
            Object levelValue = row.getOrDefault("level_no", row.get("LEVEL_NO"));
            Object countValue = row.getOrDefault("task_count", row.get("TASK_COUNT"));
            int rowLevel = ((Number) levelValue).intValue();
            int count = ((Number) countValue).intValue();
            byLevel.put(rowLevel, count);
            total += count;
            Object assignedAt = row.getOrDefault("oldest_assigned_at", row.get("OLDEST_ASSIGNED_AT"));
            if (assignedAt != null && (oldest == null || assignedAt.toString().compareTo(oldest.toString()) < 0)) oldest = assignedAt;
        }
        Map<String, Object> resultMap = new LinkedHashMap<>();
        resultMap.put("total", total);
        resultMap.put("byLevel", byLevel);
        resultMap.put("oldestAssignedAt", oldest);
        return resultMap;
    }

    @GetMapping("/history")
    @PreAuthorize("isAuthenticated()")
    public Map<String,Object> history(@RequestParam(required = false) String qaPairId,
                                      @RequestParam(required=false) String keyword,@RequestParam(required=false) Integer level,
                                      @RequestParam(required=false) String reviewerId,@RequestParam(required=false) String result,
                                      @RequestParam(required=false) String domainL1Id,@RequestParam(required=false) String domainL2Id,@RequestParam(required=false) String domainL3Id,
                                      @RequestParam(required=false) String reviewedFrom,@RequestParam(required=false) String reviewedTo,
                                      @RequestParam(defaultValue="reviewedAt") String sortBy,@RequestParam(defaultValue="desc") String sortDir,
                                      @RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="10") int pageSize,
                                      Authentication authentication) {
        AuthUser current=users.findByUsername(authentication.getName());boolean admin=current.roles().stream().anyMatch(x->Set.of("QA_ADMIN","SYS_ADMIN").contains(x));boolean reviewer=current.roles().stream().anyMatch(x->x.startsWith("QA_REVIEW_"));
        page=Math.max(1,page);pageSize=Math.min(100,Math.max(1,pageSize));
        StringBuilder sql = new StringBuilder("""
                SELECT r.reviewed_at, r.level_no, r.result, r.opinion, r.suggestion,
                       u.real_name AS reviewer_name, u.username AS reviewer_username,
                       v.qa_pair_id, p.qa_code,v.question_text,v.answer_text,
                       d1.domain_name domain_l1_name,d2.domain_name domain_l2_name,d3.domain_name domain_l3_name
                  FROM qa_review_record r
                  JOIN sys_user u ON u.id = r.reviewer_id
                  JOIN qa_pair_version v ON v.id = r.version_id
                  JOIN qa_pair p ON p.id = v.qa_pair_id
                  JOIN qa_domain d1 ON d1.id=p.domain_l1_id JOIN qa_domain d2 ON d2.id=p.domain_l2_id LEFT JOIN qa_domain d3 ON d3.id=p.domain_l3_id
                 WHERE p.deleted=0
                """);List<Object> args=new ArrayList<>();
        if(!admin){if(qaPairId!=null&&!qaPairId.isBlank()&&reviewer){}else if(reviewer){sql.append(" AND r.reviewer_id=?");args.add(current.id());}else{sql.append(" AND p.author_id=?");args.add(current.id());}}
        if(qaPairId!=null&&!qaPairId.isBlank()){sql.append(" AND p.id=?");args.add(qaPairId);}
        if(keyword!=null&&!keyword.isBlank()){sql.append(" AND (p.qa_code LIKE ? OR v.question_text LIKE ? OR v.answer_text LIKE ?)");String like="%"+keyword.trim()+"%";args.add(like);args.add(like);args.add(like);}
        if(level!=null&&level>=1&&level<=3){sql.append(" AND r.level_no=?");args.add(level);}
        if(reviewerId!=null&&!reviewerId.isBlank()){sql.append(" AND r.reviewer_id=?");args.add(reviewerId);}
        if(result!=null&&!result.isBlank()){sql.append(" AND r.result=?");args.add(result);}
        if(domainL1Id!=null&&!domainL1Id.isBlank()){sql.append(" AND p.domain_l1_id=?");args.add(domainL1Id);}
        if(domainL2Id!=null&&!domainL2Id.isBlank()){sql.append(" AND p.domain_l2_id=?");args.add(domainL2Id);}
        if(domainL3Id!=null&&!domainL3Id.isBlank()){sql.append(" AND p.domain_l3_id=?");args.add(domainL3Id);}
        if(reviewedFrom!=null&&!reviewedFrom.isBlank()){sql.append(" AND r.reviewed_at>=TO_TIMESTAMP(?,'YYYY-MM-DD HH24:MI:SS')");args.add(reviewedFrom+" 00:00:00");}
        if(reviewedTo!=null&&!reviewedTo.isBlank()){sql.append(" AND r.reviewed_at<=TO_TIMESTAMP(?,'YYYY-MM-DD HH24:MI:SS')");args.add(reviewedTo+" 23:59:59");}
        Integer total=jdbc.queryForObject("SELECT COUNT(*) FROM ("+sql+") t",Integer.class,args.toArray());
        String order=Map.of("reviewedAt","r.reviewed_at","level","r.level_no","reviewer","u.real_name","code","p.qa_code").getOrDefault(sortBy,"r.reviewed_at");sql.append(" ORDER BY ").append(order).append("asc".equalsIgnoreCase(sortDir)?" ASC":" DESC").append(" LIMIT ? OFFSET ?");args.add(pageSize);args.add((page-1)*pageSize);
        return Map.of("items",jdbc.queryForList(sql.toString(),args.toArray()),"total",total==null?0:total,"page",page,"pageSize",pageSize);
    }
    @GetMapping("/tasks")
    @PreAuthorize("hasAnyRole('QA_REVIEW_L1','QA_REVIEW_L2','QA_REVIEW_L3','QA_ADMIN','SYS_ADMIN')")
    public List<Map<String,Object>> tasks(@RequestParam(required=false) String status, Authentication authentication) {
        AuthUser u=users.findByUsername(authentication.getName()); boolean admin=u.roles().stream().anyMatch(r->Set.of("QA_ADMIN","SYS_ADMIN").contains(r));
        String sql="SELECT t.id,t.version_id,t.level_no,t.task_status,t.assigned_at,t.completed_at,p.id qa_pair_id,p.qa_code,v.question_text,ru.real_name reviewer_name FROM qa_review_task t JOIN qa_pair_version v ON v.id=t.version_id JOIN qa_pair p ON p.id=v.qa_pair_id JOIN sys_user ru ON ru.id=t.reviewer_id WHERE p.deleted=0"; List<Object> args=new ArrayList<>();
        if(!admin){sql+=" AND t.reviewer_id=?";args.add(u.id());} if(status!=null&&!status.isBlank()){sql+=" AND t.task_status=?";args.add(status);} sql+=" ORDER BY t.assigned_at DESC";return jdbc.queryForList(sql,args.toArray());
    }

    public record DecisionRequest(@NotBlank String result, String opinion, String suggestion) {}

}
