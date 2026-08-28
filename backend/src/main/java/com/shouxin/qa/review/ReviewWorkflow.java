package com.shouxin.qa.review;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.*;

/** All tasks are snapshotted at submission; subsequent flow changes cannot alter an in-flight review. */
@Service
public class ReviewWorkflow {
    private final JdbcTemplate jdbc;
    public ReviewWorkflow(JdbcTemplate jdbc) { this.jdbc=jdbc; }

    public void submit(String versionId, String pairId) {
        var flows=jdbc.queryForList("SELECT f.id FROM qa_review_flow f JOIN qa_pair p ON p.domain_l1_id=f.domain_l1_id WHERE p.id=? AND f.enabled=1 ORDER BY f.flow_version DESC",pairId);
        if(flows.isEmpty()) throw new IllegalArgumentException("该一级目录尚未配置审核流程，请联系管理员");
        String flow=String.valueOf(flows.get(0).get("id"));
        var nodes=jdbc.queryForList("SELECT id,level_no FROM qa_review_flow_node WHERE flow_id=? ORDER BY level_no",flow);
        if(nodes.isEmpty()||nodes.size()>3) throw new IllegalArgumentException("审核流程级数配置无效");
        List<Map<String,Object>> tasks=new ArrayList<>();
        for(int i=0;i<nodes.size();i++) {
            var node=nodes.get(i);
            if(((Number)node.get("level_no")).intValue()!=i+1) throw new IllegalArgumentException("审核节点必须连续");
            var reviewers=jdbc.queryForList("SELECT u.id FROM qa_review_flow_reviewer r JOIN sys_user u ON u.id=r.user_id WHERE r.node_id=? AND u.enabled=1",node.get("id"));
            if(reviewers.isEmpty()) throw new IllegalArgumentException("第"+(i+1)+"级未配置有效审核人");
            for(var reviewer:reviewers) tasks.add(Map.of("level",i+1,"reviewer",reviewer.get("id")));
        }
        // Task rows are a mutable work queue; immutable decision records preserve previous attempts.
        jdbc.update("DELETE FROM qa_review_task WHERE version_id=?",versionId);
        for(var task:tasks) jdbc.update("INSERT INTO qa_review_task(id,version_id,flow_id,level_no,reviewer_id,task_status) VALUES(?,?,?,?,?,?)",
            UUID.randomUUID().toString(),versionId,flow,task.get("level"),task.get("reviewer"),task.get("level").equals(1)?"pending":"waiting");
    }

    public String decide(String pairId, String reviewerId, String result, String opinion, String suggestion) {
        var p=jdbc.queryForList("SELECT current_version_id,status FROM qa_pair WHERE id=? AND deleted=0 FOR UPDATE",pairId)
            .stream().findFirst().orElseThrow(()->new NoSuchElementException("问答对不存在"));
        String status=String.valueOf(p.get("status"));
        if(!status.matches("pending_review_l[1-3]")) throw new IllegalArgumentException("当前状态不能审核");
        int level=Integer.parseInt(status.substring(status.length()-1));
        String version=String.valueOf(p.get("current_version_id"));
        var assigned=jdbc.queryForList("SELECT flow_id FROM qa_review_task WHERE version_id=? AND level_no=? AND reviewer_id=? AND task_status='pending'",version,level,reviewerId);
        if(assigned.isEmpty()) throw new org.springframework.security.access.AccessDeniedException("您没有待处理的审核任务，或已完成本级审核");
        if(!Set.of("pass","reject").contains(result)) throw new IllegalArgumentException("审核结果无效");
        if("reject".equals(result)&&(opinion==null||opinion.isBlank())) throw new IllegalArgumentException("驳回必须填写审核意见");
        String flow=String.valueOf(assigned.get(0).get("flow_id"));
        String rule=jdbc.queryForObject("SELECT pass_rule FROM qa_review_flow WHERE id=?",String.class,flow);
        int levels=jdbc.queryForObject("SELECT MAX(level_no) FROM qa_review_flow_node WHERE flow_id=?",Integer.class,flow);
        jdbc.update("UPDATE qa_review_task SET task_status=?,completed_at=CURRENT_TIMESTAMP WHERE version_id=? AND level_no=? AND reviewer_id=? AND task_status='pending'",result,version,level,reviewerId);
        jdbc.update("INSERT INTO qa_review_record(id,version_id,level_no,reviewer_id,result,opinion,suggestion) VALUES(?,?,?,?,?,?,?)",UUID.randomUUID().toString(),version,level,reviewerId,result,opinion,suggestion);
        String next=status;
        if("reject".equals(result)) {
            next="rejected_l"+level;
            jdbc.update("UPDATE qa_review_task SET task_status='cancelled',completed_at=CURRENT_TIMESTAMP WHERE version_id=? AND task_status IN ('pending','waiting')",version);
        } else {
            int pending=jdbc.queryForObject("SELECT COUNT(*) FROM qa_review_task WHERE version_id=? AND level_no=? AND task_status='pending'",Integer.class,version,level);
            if("ANY".equals(rule)||pending==0) {
                jdbc.update("UPDATE qa_review_task SET task_status='cancelled',completed_at=CURRENT_TIMESTAMP WHERE version_id=? AND level_no=? AND task_status='pending'",version,level);
                next=level==levels?"published":"pending_review_l"+(level+1);
                if(level<levels) activate(version,flow,level+1);
            }
        }
        jdbc.update("UPDATE qa_pair SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",next,pairId);
        jdbc.update("UPDATE qa_pair_version SET version_status=?,published_at=CASE WHEN ?='published' THEN CURRENT_TIMESTAMP ELSE published_at END WHERE id=?",next,next,version);
        if("published".equals(next)) jdbc.update("UPDATE qa_pair SET published_version_id=? WHERE id=?",version,pairId);
        return next;
    }

    private void activate(String version,String flow,int level) {
        // Supports pre-existing submissions made before task snapshots were introduced.
        var reviewers=jdbc.queryForList("SELECT r.user_id FROM qa_review_flow_node n JOIN qa_review_flow_reviewer r ON r.node_id=n.id WHERE n.flow_id=? AND n.level_no=?",flow,level);
        if(reviewers.isEmpty()) throw new IllegalArgumentException("下一审核级未配置审核人");
        for(var r:reviewers) jdbc.update("INSERT INTO qa_review_task(id,version_id,flow_id,level_no,reviewer_id,task_status) SELECT ?,?,?,?,?,'waiting' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM qa_review_task WHERE version_id=? AND level_no=? AND reviewer_id=?)",UUID.randomUUID().toString(),version,flow,level,r.get("user_id"),version,level,r.get("user_id"));
        jdbc.update("UPDATE qa_review_task SET task_status='pending',assigned_at=CURRENT_TIMESTAMP WHERE version_id=? AND level_no=? AND task_status='waiting'",version,level);
    }
}
