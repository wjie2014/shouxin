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

    public ReviewController(JdbcTemplate jdbc, AuthUserService users, OperationLogService logs) { this.jdbc = jdbc; this.users = users; this.logs = logs; }

    @GetMapping("/pending")
    @PreAuthorize("hasAnyRole('QA_REVIEW_L1','QA_REVIEW_L2','QA_REVIEW_L3','QA_ADMIN','SYS_ADMIN')")
    public Map<String, Object> pending(@RequestParam(defaultValue = "1") int level, @RequestParam(defaultValue = "1") int page,
                                       @RequestParam(defaultValue = "10") int pageSize, Authentication authentication) {
        if (level < 1 || level > 3) throw new IllegalArgumentException("审核级别必须为1、2或3");
        page = Math.max(page, 1); pageSize = Math.max(1, Math.min(pageSize, 100));
        AuthUser user = users.findByUsername(authentication.getName());
        String status = "pending_review_l" + level;
        boolean privileged = user.roles().stream().anyMatch(r -> Set.of("QA_ADMIN", "SYS_ADMIN").contains(r));
        StringBuilder sql = new StringBuilder("SELECT p.id, p.qa_code, p.status, p.updated_at, v.question_text, u.real_name FROM qa_pair p JOIN qa_pair_version v ON v.id = p.current_version_id JOIN sys_user u ON u.id = p.author_id WHERE p.deleted = 0 AND p.status = ?");
        List<Object> args = new ArrayList<>(List.of(status));
        if (!privileged) {
            sql.append(" AND EXISTS (SELECT 1 FROM qa_review_task rt WHERE rt.version_id = p.current_version_id AND rt.level_no = ? AND rt.reviewer_id = ? AND rt.task_status = 'pending')");
            args.add(level); args.add(user.id());
        }
        Integer total = jdbc.queryForObject("SELECT COUNT(*) FROM (" + sql + ") t", Integer.class, args.toArray());
        sql.append(" ORDER BY p.updated_at ASC LIMIT ? OFFSET ?"); args.add(pageSize); args.add((page - 1) * pageSize);
        return Map.of("items", jdbc.queryForList(sql.toString(), args.toArray()), "total", total == null ? 0 : total, "page", page, "pageSize", pageSize, "level", level);
    }

    @PostMapping("/{qaPairId}/decision")
    @PreAuthorize("hasAnyRole('QA_REVIEW_L1','QA_REVIEW_L2','QA_REVIEW_L3','QA_ADMIN','SYS_ADMIN')")
    @Transactional
    public Map<String, Object> decide(@PathVariable String qaPairId, @Valid @RequestBody DecisionRequest request, Authentication authentication) {
        AuthUser reviewer = users.findByUsername(authentication.getName());
        String result = request.result().trim().toLowerCase(Locale.ROOT);
        if (!Set.of("pass", "reject").contains(result)) throw new IllegalArgumentException("审核结果只能是pass或reject");
        Map<String, Object> pair = jdbc.queryForList("SELECT id, current_version_id, status FROM qa_pair WHERE id = ? AND deleted = 0 FOR UPDATE", qaPairId).stream().findFirst().orElseThrow(() -> new NoSuchElementException("问答对不存在"));
        String status = String.valueOf(pair.get("status"));
        int level = switch (status) { case "pending_review_l1" -> 1; case "pending_review_l2" -> 2; case "pending_review_l3" -> 3; default -> 0; };
        if (level == 0) throw new IllegalArgumentException("当前状态不在审核流程中");
        Integer assigned = jdbc.queryForObject("SELECT COUNT(*) FROM qa_review_task WHERE version_id=? AND level_no=? AND reviewer_id=? AND task_status='pending'", Integer.class, pair.get("current_version_id"), level, reviewer.id());
        boolean privileged = reviewer.roles().stream().anyMatch(r -> Set.of("SYS_ADMIN", "QA_ADMIN").contains(r));
        boolean allowed = privileged || (assigned != null && assigned > 0 && reviewer.roles().contains("QA_REVIEW_L" + level));
        if (!allowed) throw new org.springframework.security.access.AccessDeniedException("当前用户未被分配该审核任务");
        if ("reject".equals(result) && (request.opinion() == null || request.opinion().isBlank())) throw new IllegalArgumentException("驳回时必须填写审核意见");
        String versionId = String.valueOf(pair.get("current_version_id"));
        jdbc.update("INSERT INTO qa_review_record(id, version_id, level_no, reviewer_id, result, opinion, suggestion) VALUES (?, ?, ?, ?, ?, ?, ?)", UUID.randomUUID().toString(), versionId, level, reviewer.id(), result, request.opinion(), request.suggestion());
        jdbc.update("UPDATE qa_review_task SET task_status=?, completed_at=CURRENT_TIMESTAMP WHERE version_id=? AND level_no=? AND reviewer_id=? AND task_status='pending'", result, versionId, level, reviewer.id());
        if ("reject".equals(result)) {
            jdbc.update("UPDATE qa_review_task SET task_status='cancelled', completed_at=CURRENT_TIMESTAMP WHERE version_id=? AND level_no=? AND task_status='pending'", versionId, level);
        }
        String passRule = String.valueOf(jdbc.queryForObject("SELECT pass_rule FROM qa_review_flow WHERE domain_l1_id=(SELECT domain_l1_id FROM qa_pair WHERE id=?) AND enabled=1 ORDER BY flow_version DESC FETCH FIRST 1 ROWS ONLY", String.class, qaPairId));
        Integer configuredLevels = jdbc.queryForObject("SELECT MAX(n.level_no) FROM qa_review_flow f JOIN qa_review_flow_node n ON n.flow_id=f.id WHERE f.domain_l1_id=(SELECT domain_l1_id FROM qa_pair WHERE id=?) AND f.enabled=1", Integer.class, qaPairId);
        int maxLevel = configuredLevels == null ? 3 : configuredLevels;
        Integer pending = jdbc.queryForObject("SELECT COUNT(*) FROM qa_review_task WHERE version_id=? AND level_no=? AND task_status='pending'", Integer.class, versionId, level);
        Integer failed = jdbc.queryForObject("SELECT COUNT(*) FROM qa_review_task WHERE version_id=? AND level_no=? AND task_status='reject'", Integer.class, versionId, level);
        boolean levelPassed = "pass".equals(result) && ("ANY".equalsIgnoreCase(passRule) || (pending == null || pending == 0) && (failed == null || failed == 0));
        if (levelPassed && "ANY".equalsIgnoreCase(passRule)) jdbc.update("UPDATE qa_review_task SET task_status='cancelled',completed_at=CURRENT_TIMESTAMP WHERE version_id=? AND level_no=? AND task_status='pending'", versionId, level);
        String nextStatus = "reject".equals(result) ? "rejected_l" + level : (levelPassed ? (level >= maxLevel ? "published" : "pending_review_l" + (level + 1)) : "pending_review_l" + level);
        if ("published".equals(nextStatus)) {
            jdbc.update("UPDATE qa_pair SET status = ?, published_version_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", nextStatus, versionId, qaPairId);
        } else {
            jdbc.update("UPDATE qa_pair SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", nextStatus, qaPairId);
        }
        jdbc.update("UPDATE qa_pair_version SET version_status = ?, published_at = CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE published_at END WHERE id = ?", nextStatus, nextStatus, versionId);
        if (levelPassed && level < maxLevel) {
            createTasks(versionId, qaPairId, level + 1);
            jdbc.update("UPDATE qa_review_task SET task_status='pending',assigned_at=CURRENT_TIMESTAMP WHERE version_id=? AND level_no=? AND task_status='waiting'", versionId, level + 1);
        }
        logs.record(reviewer.id(), "REVIEW_QA_PAIR", request.result() + " level=" + level, "QA_PAIR", qaPairId);
        return Map.of("qaPairId", qaPairId, "level", level, "result", request.result(), "status", nextStatus);
    }

    @GetMapping("/history")
    @PreAuthorize("isAuthenticated()")
    public List<Map<String, Object>> history(@RequestParam(required = false) String qaPairId) {
        if (qaPairId == null || qaPairId.isBlank()) return jdbc.queryForList("SELECT r.reviewed_at, r.level_no, r.result, r.opinion, r.suggestion, u.real_name AS reviewer_name, v.qa_pair_id FROM qa_review_record r JOIN sys_user u ON u.id = r.reviewer_id JOIN qa_pair_version v ON v.id = r.version_id ORDER BY r.reviewed_at DESC");
        return jdbc.queryForList("SELECT r.reviewed_at, r.level_no, r.result, r.opinion, r.suggestion, u.real_name AS reviewer_name, v.qa_pair_id FROM qa_review_record r JOIN sys_user u ON u.id = r.reviewer_id JOIN qa_pair_version v ON v.id = r.version_id WHERE v.qa_pair_id = ? ORDER BY r.reviewed_at DESC", qaPairId);
    }
    @GetMapping("/tasks")
    @PreAuthorize("hasAnyRole('QA_REVIEW_L1','QA_REVIEW_L2','QA_REVIEW_L3','QA_ADMIN','SYS_ADMIN')")
    public List<Map<String,Object>> tasks(@RequestParam(required=false) String status, Authentication authentication) {
        AuthUser u=users.findByUsername(authentication.getName()); boolean admin=u.roles().stream().anyMatch(r->Set.of("QA_ADMIN","SYS_ADMIN").contains(r));
        String sql="SELECT t.id,t.version_id,t.level_no,t.task_status,t.assigned_at,t.completed_at,p.id qa_pair_id,p.qa_code,v.question_text,ru.real_name reviewer_name FROM qa_review_task t JOIN qa_pair_version v ON v.id=t.version_id JOIN qa_pair p ON p.id=v.qa_pair_id JOIN sys_user ru ON ru.id=t.reviewer_id WHERE p.deleted=0"; List<Object> args=new ArrayList<>();
        if(!admin){sql+=" AND t.reviewer_id=?";args.add(u.id());} if(status!=null&&!status.isBlank()){sql+=" AND t.task_status=?";args.add(status);} sql+=" ORDER BY t.assigned_at DESC";return jdbc.queryForList(sql,args.toArray());
    }

    public record DecisionRequest(@NotBlank String result, String opinion, String suggestion) {}

    private void createTasks(String versionId, String pairId, int level) {
        List<Map<String,Object>> rows = jdbc.queryForList("SELECT f.id flow_id,r.user_id FROM qa_review_flow f JOIN qa_review_flow_node n ON n.flow_id=f.id AND n.level_no=? JOIN qa_review_flow_reviewer r ON r.node_id=n.id WHERE f.domain_l1_id=(SELECT domain_l1_id FROM qa_pair WHERE id=?) AND f.enabled=1", level, pairId);
        for (Map<String,Object> row: rows) jdbc.update("INSERT INTO qa_review_task(id,version_id,flow_id,level_no,reviewer_id,task_status) SELECT ?,?,?,?,?, 'pending' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_review_task WHERE version_id=? AND level_no=? AND reviewer_id=? )", UUID.randomUUID().toString(),versionId,row.get("FLOW_ID"),level,row.get("USER_ID"),versionId,level,row.get("USER_ID"));
    }
}
