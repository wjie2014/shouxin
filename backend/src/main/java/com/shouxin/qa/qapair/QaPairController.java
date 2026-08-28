package com.shouxin.qa.qapair;

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
@RequestMapping("/api/qa-pairs")
public class QaPairController {
    private final JdbcTemplate jdbc;
    private final AuthUserService users;
    private final OperationLogService logs;
    private final com.shouxin.qa.review.ReviewWorkflow workflow;
    private final PairAccess access;

    public QaPairController(JdbcTemplate jdbc, AuthUserService users, OperationLogService logs, com.shouxin.qa.review.ReviewWorkflow workflow, PairAccess access) { this.jdbc = jdbc; this.users = users; this.logs = logs; this.workflow = workflow; this.access = access; }

    @PostMapping
    @PreAuthorize("hasAnyRole('QA_SUBMITTER','QA_ADMIN','SYS_ADMIN')")
    @Transactional
    public Map<String, Object> create(Authentication authentication, @Valid @RequestBody CreateQaRequest request) {
        AuthUser user = users.findByUsername(authentication.getName());
        validateDomain(request.domainL1Id(), request.domainL2Id(), request.domainL3Id());
        String pairId = UUID.randomUUID().toString(), versionId = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO qa_pair(id, qa_code, current_version_id, domain_l1_id, domain_l2_id, domain_l3_id, author_id, unit_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT unit_id FROM sys_user WHERE id = ?), 'draft')",
                pairId, nextQaCode(), versionId, request.domainL1Id(), request.domainL2Id(), request.domainL3Id(), user.id(), user.id());
        jdbc.update("INSERT INTO qa_pair_version(id, qa_pair_id, version_no, question_html, question_text, answer_html, answer_text, reference_doc, extension_data, version_status, created_by) VALUES (?, ?, 'V1.0', ?, ?, ?, ?, ?, ?, 'draft', ?)",
                versionId, pairId, request.questionHtml(), stripHtml(request.questionHtml()), request.answerHtml(), stripHtml(request.answerHtml()), request.referenceDoc(), request.extensionData(), user.id());
        jdbc.update("UPDATE qa_pair SET current_version_id = ? WHERE id = ?", versionId, pairId);
        logs.record(user.id(), "CREATE_QA_PAIR", "创建问答对", "QA_PAIR", pairId);
        return detail(pairId);
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> list(@RequestParam(required = false) String status, @RequestParam(required = false) String keyword,
                                    @RequestParam(required = false) String domainL1Id, @RequestParam(required = false) String domainL2Id,
                                    @RequestParam(required = false) String domainL3Id, @RequestParam(required = false) String submitFrom,
                                    @RequestParam(required = false) String submitTo, @RequestParam(defaultValue = "updatedAt") String sortBy,
                                    @RequestParam(defaultValue = "desc") String sortDir,
                                    @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int pageSize,
                                    Authentication authentication) {
        AuthUser user = users.findByUsername(authentication.getName());
        page = Math.max(page, 1); pageSize = Math.max(1, Math.min(pageSize, 100));
        int offset = (page - 1) * pageSize;
        StringBuilder sql = new StringBuilder("SELECT p.id, p.qa_code, p.status, p.created_at, p.updated_at, v.submitted_at, v.question_text, v.version_no, u.real_name, d1.domain_name domain_l1_name, d2.domain_name domain_l2_name, d3.domain_name domain_l3_name FROM qa_pair p JOIN qa_pair_version v ON v.id = p.current_version_id JOIN sys_user u ON u.id = p.author_id JOIN qa_domain d1 ON d1.id=p.domain_l1_id JOIN qa_domain d2 ON d2.id=p.domain_l2_id LEFT JOIN qa_domain d3 ON d3.id=p.domain_l3_id WHERE p.deleted = 0");
        List<Object> args = new ArrayList<>();
        boolean privileged = user.roles().stream().anyMatch(r -> Set.of("QA_ADMIN", "SYS_ADMIN").contains(r));
        if (!privileged) { sql.append(" AND p.author_id = ?"); args.add(user.id()); }
        if (status != null && !status.isBlank()) { sql.append(" AND p.status = ?"); args.add(status); }
        if (keyword != null && !keyword.isBlank()) { sql.append(" AND (p.qa_code LIKE ? OR v.question_text LIKE ?)"); args.add("%" + keyword + "%"); args.add("%" + keyword + "%"); }
        if (domainL1Id != null && !domainL1Id.isBlank()) { sql.append(" AND p.domain_l1_id = ?"); args.add(domainL1Id); }
        if (domainL2Id != null && !domainL2Id.isBlank()) { sql.append(" AND p.domain_l2_id = ?"); args.add(domainL2Id); }
        if (domainL3Id != null && !domainL3Id.isBlank()) { sql.append(" AND p.domain_l3_id = ?"); args.add(domainL3Id); }
        if (submitFrom != null && !submitFrom.isBlank()) { sql.append(" AND v.submitted_at >= TO_TIMESTAMP(?, 'YYYY-MM-DD HH24:MI:SS')"); args.add(submitFrom.length() == 10 ? submitFrom + " 00:00:00" : submitFrom); }
        if (submitTo != null && !submitTo.isBlank()) { sql.append(" AND v.submitted_at <= TO_TIMESTAMP(?, 'YYYY-MM-DD HH24:MI:SS')"); args.add(submitTo.length() == 10 ? submitTo + " 23:59:59" : submitTo); }
        Integer total = jdbc.queryForObject("SELECT COUNT(*) FROM (" + sql + ") t", Integer.class, args.toArray());
        Map<String,String> sortColumns=Map.of("updatedAt","p.updated_at","createdAt","p.created_at","submittedAt","v.submitted_at","code","p.qa_code","question","v.question_text");
        String order=sortColumns.getOrDefault(sortBy,"p.updated_at"); String direction="asc".equalsIgnoreCase(sortDir)?"ASC":"DESC";
        sql.append(" ORDER BY ").append(order).append(' ').append(direction).append(" LIMIT ? OFFSET ?"); args.add(pageSize); args.add(offset);
        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
        return Map.of("items", rows, "page", page, "pageSize", pageSize, "total", total == null ? 0 : total);
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> get(@PathVariable String id, Authentication authentication) { return detailWithAccess(id, authentication); }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasAnyRole('QA_SUBMITTER','QA_ADMIN','SYS_ADMIN')")
    @Transactional
    public Map<String, Object> submit(@PathVariable String id, Authentication authentication) {
        Map<String, Object> pair = detailWithAccess(id, authentication);
        if (!Set.of("draft", "updating", "rejected_l1", "rejected_l2", "rejected_l3").contains(String.valueOf(pair.get("status")))) throw new IllegalArgumentException("当前状态不能提交审核");
        jdbc.update("UPDATE qa_pair SET status = 'pending_review_l1', updated_at = CURRENT_TIMESTAMP WHERE id = ?", id);
        jdbc.update("UPDATE qa_pair_version SET version_status = 'pending_review_l1', submitted_at = CURRENT_TIMESTAMP WHERE qa_pair_id = ? AND id = ?", id, pair.get("currentVersionId"));
        workflow.submit(String.valueOf(pair.get("currentVersionId")), id);
        logs.record(users.findByUsername(authentication.getName()).id(), "SUBMIT_QA_PAIR", "提交审核", "QA_PAIR", id);
        return detail(id);
    }

    @PostMapping("/{id}/update")
    @PreAuthorize("hasAnyRole('QA_SUBMITTER','QA_ADMIN','SYS_ADMIN')")
    @Transactional
    public Map<String, Object> startUpdate(@PathVariable String id, Authentication authentication, @Valid @RequestBody UpdateQaRequest request) {
        AuthUser user = users.findByUsername(authentication.getName());
        Map<String, Object> current = detailWithAccess(id, authentication);
        if (!Set.of("published", "retired").contains(String.valueOf(current.get("status")))) throw new IllegalArgumentException("仅已发布或已退役问答对可以发起更新");
        if (request.changeReason() == null || request.changeReason().isBlank()) throw new IllegalArgumentException("变更原因不能为空");
        String oldVersion = String.valueOf(current.get("version_no"));
        int next = 1;
        try { next = Integer.parseInt(oldVersion.replaceFirst("[^0-9]*([0-9]+).*", "$1")) + 1; } catch (RuntimeException ignored) { }
        String versionId = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO qa_pair_version(id, qa_pair_id, version_no, question_html, question_text, answer_html, answer_text, reference_doc, extension_data, version_status, change_reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)",
                versionId, id, "V" + next + ".0", request.questionHtml(), stripHtml(request.questionHtml()), request.answerHtml(), stripHtml(request.answerHtml()), request.referenceDoc(), request.extensionData(), request.changeReason(), user.id());
        jdbc.update("UPDATE qa_pair SET current_version_id = ?, status = 'updating', updated_at = CURRENT_TIMESTAMP WHERE id = ?", versionId, id);
        return detail(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('QA_SUBMITTER','QA_ADMIN','SYS_ADMIN')")
    @Transactional
    public Map<String,Object> editDraft(@PathVariable String id, Authentication authentication, @Valid @RequestBody EditQaRequest request) {
        Map<String,Object> pair=detailWithAccess(id,authentication);
        if(!Set.of("draft","updating","rejected_l1","rejected_l2","rejected_l3").contains(String.valueOf(pair.get("status")))) throw new IllegalArgumentException("当前状态不可修改");
        validateDomain(request.domainL1Id(),request.domainL2Id(),request.domainL3Id());
        jdbc.update("UPDATE qa_pair SET domain_l1_id=?,domain_l2_id=?,domain_l3_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",request.domainL1Id(),request.domainL2Id(),request.domainL3Id(),id);
        jdbc.update("UPDATE qa_pair_version SET question_html=?,question_text=?,answer_html=?,answer_text=?,reference_doc=?,extension_data=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",request.questionHtml(),stripHtml(request.questionHtml()),request.answerHtml(),stripHtml(request.answerHtml()),request.referenceDoc(),request.extensionData(),pair.get("currentVersionId"));
        logs.record(users.findByUsername(authentication.getName()).id(),"UPDATE_QA_PAIR","修改问答对","QA_PAIR",id); return detail(id);
    }

    @PostMapping("/{id}/retire")
    @PreAuthorize("hasAnyRole('QA_ADMIN','SYS_ADMIN')")
    @Transactional
    public Map<String, Object> retire(@PathVariable String id, @RequestBody RetireRequest request, Authentication authentication) {
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("退役原因不能为空");
        int updated = jdbc.update("UPDATE qa_pair SET status = 'retired', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'published'", id);
        if (updated != 1) throw new IllegalArgumentException("仅已发布问答对可以退役");
        jdbc.update("UPDATE qa_pair_version SET version_status = 'retired', retired_at = CURRENT_TIMESTAMP, change_reason = ? WHERE id = (SELECT current_version_id FROM qa_pair WHERE id = ?)", request.reason(), id);
        logs.record(users.findByUsername(authentication.getName()).id(), "RETIRE_QA_PAIR", request.reason(), "QA_PAIR", id);
        return detail(id);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('QA_ADMIN','SYS_ADMIN')")
    @Transactional
    public void delete(@PathVariable String id, Authentication authentication) {
        if (jdbc.update("UPDATE qa_pair SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted = 0", id) != 1) throw new NoSuchElementException("问答对不存在");
        logs.record(users.findByUsername(authentication.getName()).id(), "DELETE_QA_PAIR", "删除问答对", "QA_PAIR", id);
    }

    @PostMapping("/batch/submit")
    @PreAuthorize("hasAnyRole('QA_SUBMITTER','QA_ADMIN','SYS_ADMIN')")
    @Transactional
    public Map<String,Object> batchSubmit(@RequestBody IdsRequest request, Authentication authentication) {
        if (request == null || request.ids() == null || request.ids().isEmpty()) throw new IllegalArgumentException("请选择要提交的问答对");
        int count=0; for(String id:request.ids()){Map<String,Object> pair=detailWithAccess(id,authentication);if(Set.of("draft","updating","rejected_l1","rejected_l2","rejected_l3").contains(String.valueOf(pair.get("status")))){jdbc.update("UPDATE qa_pair SET status='pending_review_l1',updated_at=CURRENT_TIMESTAMP WHERE id=?",id);jdbc.update("UPDATE qa_pair_version SET version_status='pending_review_l1',submitted_at=CURRENT_TIMESTAMP WHERE id=?",pair.get("currentVersionId"));workflow.submit(String.valueOf(pair.get("currentVersionId")),id);count++;}}
        return Map.of("submitted",count,"total",request.ids().size());
    }

    @PostMapping("/batch/delete")
    @PreAuthorize("hasAnyRole('QA_ADMIN','SYS_ADMIN')")
    @Transactional
    public Map<String,Object> batchDelete(@RequestBody IdsRequest request, Authentication authentication) {
        if (request == null || request.ids() == null || request.ids().isEmpty()) throw new IllegalArgumentException("请选择要删除的问答对");
        int count=0; for(String id:request.ids()) count += jdbc.update("UPDATE qa_pair SET deleted=1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted=0",id);
        logs.record(users.findByUsername(authentication.getName()).id(),"BATCH_DELETE_QA_PAIR","批量删除"+count+"条问答对","QA_PAIR",null); return Map.of("deleted",count,"total",request.ids().size());
    }

    private Map<String, Object> detailWithAccess(String id, Authentication authentication) {
        Map<String, Object> row = detail(id);
        AuthUser user = users.findByUsername(authentication.getName());
        boolean privileged = user.roles().stream().anyMatch(r -> Set.of("QA_ADMIN", "SYS_ADMIN").contains(r));
        boolean assigned = jdbc.queryForObject("SELECT COUNT(*) FROM qa_review_task WHERE version_id=? AND reviewer_id=?", Integer.class, row.get("currentVersionId"), user.id()) > 0;
        if (!privileged && !user.id().equals(row.get("authorId")) && !assigned) throw new org.springframework.security.access.AccessDeniedException("无权访问该问答对");
        return row;
    }

    private Map<String, Object> detail(String id) {
        var rows = jdbc.queryForList("SELECT p.id, p.qa_code, p.status, p.author_id, p.current_version_id, p.domain_l1_id, p.domain_l2_id, p.domain_l3_id, p.created_at, p.updated_at, v.version_no, v.question_html, v.answer_html, v.reference_doc, v.extension_data, u.real_name, d1.domain_name domain_l1_name, d2.domain_name domain_l2_name, d3.domain_name domain_l3_name FROM qa_pair p JOIN qa_pair_version v ON v.id = p.current_version_id JOIN sys_user u ON u.id = p.author_id JOIN qa_domain d1 ON d1.id=p.domain_l1_id JOIN qa_domain d2 ON d2.id=p.domain_l2_id LEFT JOIN qa_domain d3 ON d3.id=p.domain_l3_id WHERE p.id = ? AND p.deleted = 0", id);
        if (rows.isEmpty()) throw new NoSuchElementException("问答对不存在");
        Map<String, Object> r = new LinkedHashMap<>(rows.get(0));
        r.put("authorId", r.remove("author_id")); r.put("currentVersionId", r.remove("current_version_id"));
        r.put("domainL1Id", r.remove("domain_l1_id")); r.put("domainL2Id", r.remove("domain_l2_id")); r.put("domainL3Id", r.remove("domain_l3_id"));
        return r;
    }

    @GetMapping("/{id}/versions")
    @PreAuthorize("isAuthenticated()")
    public List<Map<String,Object>> versions(@PathVariable String id, Authentication authentication) {
        detailWithAccess(id, authentication);
        return jdbc.queryForList("SELECT v.id, v.version_no, v.version_status, v.change_reason, v.created_at, v.submitted_at, v.published_at, v.retired_at, u.real_name AS created_by_name FROM qa_pair_version v JOIN sys_user u ON u.id=v.created_by WHERE v.qa_pair_id=? ORDER BY v.created_at DESC", id);
    }

    private void validateDomain(String l1, String l2, String l3) {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM qa_domain WHERE id = ? AND level_no = 1 AND enabled = 1 AND deleted = 0", Integer.class, l1) != 1) throw new IllegalArgumentException("一级目录不存在");
        if (jdbc.queryForObject("SELECT COUNT(*) FROM qa_domain WHERE id = ? AND parent_id = ? AND level_no = 2 AND enabled = 1 AND deleted = 0", Integer.class, l2, l1) != 1) throw new IllegalArgumentException("二级目录不存在或不属于一级目录");
        if (l3 != null && !l3.isBlank() && jdbc.queryForObject("SELECT COUNT(*) FROM qa_domain WHERE id = ? AND parent_id = ? AND level_no = 3 AND enabled = 1 AND deleted = 0", Integer.class, l3, l2) != 1) throw new IllegalArgumentException("三级目录不存在或不属于二级目录");
    }

    private String nextQaCode() { Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM qa_pair", Integer.class); return "QA-" + java.time.Year.now() + "-" + String.format("%04d", (n == null ? 0 : n) + 1); }
    private void createReviewTasks(String versionId, String pairId, int level) {
        List<Map<String,Object>> rows = jdbc.queryForList("SELECT f.id flow_id,n.id node_id,r.user_id FROM qa_review_flow f JOIN qa_review_flow_node n ON n.flow_id=f.id AND n.level_no=? JOIN qa_review_flow_reviewer r ON r.node_id=n.id WHERE f.domain_l1_id=(SELECT domain_l1_id FROM qa_pair WHERE id=?) AND f.enabled=1", level, pairId);
        for (Map<String,Object> row: rows) jdbc.update("INSERT INTO qa_review_task(id,version_id,flow_id,level_no,reviewer_id,task_status) SELECT ?,?,?,?,?, 'pending' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_review_task WHERE version_id=? AND level_no=? AND reviewer_id=?)", UUID.randomUUID().toString(), versionId, row.get("FLOW_ID"), level, row.get("USER_ID"), versionId, level, row.get("USER_ID"));
    }
    private String stripHtml(String html) { return html.replaceAll("<[^>]*>", " ").replaceAll("\\s+", " ").trim(); }

    public record CreateQaRequest(@NotBlank String domainL1Id, @NotBlank String domainL2Id, String domainL3Id,
                                  @NotBlank String questionHtml, @NotBlank String answerHtml, String referenceDoc, String extensionData) {}
    public record UpdateQaRequest(@NotBlank String questionHtml, @NotBlank String answerHtml, String referenceDoc, String extensionData, String changeReason) {}
    public record EditQaRequest(@NotBlank String domainL1Id,@NotBlank String domainL2Id,String domainL3Id,@NotBlank String questionHtml,@NotBlank String answerHtml,String referenceDoc,String extensionData) {}
    public record RetireRequest(String reason) {}
    public record IdsRequest(List<String> ids) {}
}
