package com.shouxin.qa.review;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/admin/review-flows")
@PreAuthorize("hasAnyRole('QA_ADMIN','SYS_ADMIN')")
public class ReviewFlowAdminController {
    private final JdbcTemplate jdbc;
    public ReviewFlowAdminController(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    @GetMapping public List<Map<String,Object>> list() { return jdbc.queryForList("SELECT f.id,f.domain_l1_id,d.domain_name,f.flow_version,f.pass_rule,f.enabled FROM qa_review_flow f JOIN qa_domain d ON d.id=f.domain_l1_id WHERE f.enabled=1 ORDER BY d.sort_order,f.flow_version DESC"); }
    @GetMapping("/{id}") public Map<String,Object> get(@PathVariable String id) { Map<String,Object> r=jdbc.queryForMap("SELECT id,domain_l1_id,flow_version,pass_rule,enabled FROM qa_review_flow WHERE id=?",id); r.put("nodes",jdbc.queryForList("SELECT n.id,n.level_no,n.node_name,LISTAGG(u.real_name,',') WITHIN GROUP (ORDER BY u.real_name) reviewers,LISTAGG(fr.user_id,',') WITHIN GROUP (ORDER BY fr.user_id) reviewer_ids FROM qa_review_flow_node n LEFT JOIN qa_review_flow_reviewer fr ON fr.node_id=n.id LEFT JOIN sys_user u ON u.id=fr.user_id WHERE n.flow_id=? GROUP BY n.id,n.level_no,n.node_name ORDER BY n.level_no",id)); return r; }
    @PutMapping("/{id}") @Transactional public void update(@PathVariable String id,@Valid @RequestBody FlowRequest req) {
        if (!Set.of("ANY","ALL").contains(req.passRule().toUpperCase(Locale.ROOT))) throw new IllegalArgumentException("通过规则只能是ANY或ALL");
        if (jdbc.update("UPDATE qa_review_flow SET pass_rule=?,flow_version=flow_version+1 WHERE id=?",req.passRule().toUpperCase(Locale.ROOT),id)!=1) throw new NoSuchElementException("审核流程不存在");
        if (req.nodes()==null) return;
        int levels=req.levelCount()==null?req.nodes().size():req.levelCount(); if(levels<1||levels>3) throw new IllegalArgumentException("审核级数只能为1、2或3");
        Map<Integer,List<String>> oldReviewers=new HashMap<>(); for(Map<String,Object> x:jdbc.queryForList("SELECT n.level_no,fr.user_id FROM qa_review_flow_node n JOIN qa_review_flow_reviewer fr ON fr.node_id=n.id WHERE n.flow_id=?",id)) oldReviewers.computeIfAbsent(((Number)x.get("LEVEL_NO")).intValue(),k->new ArrayList<>()).add(String.valueOf(x.get("USER_ID")));
        jdbc.update("DELETE FROM qa_review_flow_reviewer WHERE node_id IN (SELECT id FROM qa_review_flow_node WHERE flow_id=?)",id); jdbc.update("DELETE FROM qa_review_flow_node WHERE flow_id=?",id);
        for(int i=0;i<levels;i++){NodeConfig n=i<req.nodes().size()?req.nodes().get(i):new NodeConfig("第"+(i+1)+"级审核",null);String node=UUID.randomUUID().toString();jdbc.update("INSERT INTO qa_review_flow_node(id,flow_id,level_no,node_name) VALUES(?,?,?,?)",node,id,i+1,n.name()==null||n.name().isBlank()?"第"+(i+1)+"级审核":n.name());List<String> ids=(n.reviewerIds()==null||n.reviewerIds().isEmpty())?oldReviewers.getOrDefault(i+1,List.of()):n.reviewerIds();for(String uid:ids){if(jdbc.queryForObject("SELECT COUNT(*) FROM sys_user WHERE id=? AND enabled=1",Integer.class,uid)!=1)throw new IllegalArgumentException("审核人员不存在或已禁用");jdbc.update("INSERT INTO qa_review_flow_reviewer(node_id,user_id) VALUES(?,?)",node,uid);}}
    }
    public record FlowRequest(@NotBlank String passRule,Integer levelCount,List<NodeConfig> nodes){}
    public record NodeConfig(String name,List<String> reviewerIds){}
}
