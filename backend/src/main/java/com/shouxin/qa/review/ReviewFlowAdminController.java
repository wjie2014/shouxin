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
@PreAuthorize("hasAuthority('config:flows')")
public class ReviewFlowAdminController {
    private final JdbcTemplate jdbc;
    public ReviewFlowAdminController(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    @GetMapping public List<Map<String,Object>> list() { return jdbc.queryForList("SELECT f.id,f.domain_l1_id,d.domain_name,f.flow_version,f.pass_rule,f.enabled FROM qa_review_flow f JOIN qa_domain d ON d.id=f.domain_l1_id WHERE f.enabled=1 ORDER BY d.sort_order,f.flow_version DESC"); }
    @GetMapping("/{id}") public Map<String,Object> get(@PathVariable String id) {
        if (id == null || id.isBlank() || "undefined".equalsIgnoreCase(id) || "null".equalsIgnoreCase(id)) {
            throw new NoSuchElementException("审核流程不存在");
        }
        var rows = jdbc.queryForList("SELECT id,domain_l1_id,flow_version,pass_rule,enabled FROM qa_review_flow WHERE id=?", id);
        if (rows.isEmpty()) throw new NoSuchElementException("审核流程不存在");
        Map<String,Object> r = rows.get(0);
        r.put("nodes", jdbc.queryForList("SELECT n.id,n.level_no,n.node_name,LISTAGG(u.real_name,',') WITHIN GROUP (ORDER BY u.real_name) reviewers,LISTAGG(fr.user_id,',') WITHIN GROUP (ORDER BY fr.user_id) reviewer_ids FROM qa_review_flow_node n LEFT JOIN qa_review_flow_reviewer fr ON fr.node_id=n.id LEFT JOIN sys_user u ON u.id=fr.user_id WHERE n.flow_id=? GROUP BY n.id,n.level_no,n.node_name ORDER BY n.level_no", id));
        return r;
    }
    @PutMapping("/{id}") @Transactional public Map<String,Object> update(@PathVariable String id,@Valid @RequestBody FlowRequest req) {
        if (!Set.of("ANY","ALL").contains(req.passRule().toUpperCase(Locale.ROOT))) throw new IllegalArgumentException("通过规则只能是ANY或ALL");
        Map<String,Object> old=jdbc.queryForList("SELECT domain_l1_id,flow_version FROM qa_review_flow WHERE id=? AND enabled=1 FOR UPDATE",id).stream().findFirst().orElseThrow(()->new NoSuchElementException("审核流程不存在"));
        List<Map<String,Object>> oldNodes=jdbc.queryForList("SELECT n.level_no,n.node_name,fr.user_id FROM qa_review_flow_node n LEFT JOIN qa_review_flow_reviewer fr ON fr.node_id=n.id WHERE n.flow_id=? ORDER BY n.level_no",id);
        Map<Integer,String> oldNames=new HashMap<>();Map<Integer,List<String>> oldReviewers=new HashMap<>();
        for(Map<String,Object> x:oldNodes){int level=((Number)value(x,"level_no")).intValue();oldNames.put(level,String.valueOf(value(x,"node_name")));Object uid=value(x,"user_id");if(uid!=null)oldReviewers.computeIfAbsent(level,k->new ArrayList<>()).add(String.valueOf(uid));}
        int levels=req.levelCount()==null?(req.nodes()==null?oldNames.size():req.nodes().size()):req.levelCount(); if(levels<1||levels>3) throw new IllegalArgumentException("审核级数只能为1、2或3");
        String newId=UUID.randomUUID().toString();int nextVersion=((Number)value(old,"flow_version")).intValue()+1;
        jdbc.update("INSERT INTO qa_review_flow(id,domain_l1_id,flow_version,pass_rule,enabled,created_by) SELECT ?,domain_l1_id,?,?,1,created_by FROM qa_review_flow WHERE id=?",newId,nextVersion,req.passRule().toUpperCase(Locale.ROOT),id);
        for(int i=0;i<levels;i++){
            NodeConfig supplied=req.nodes()!=null&&i<req.nodes().size()?req.nodes().get(i):null;
            String name=supplied==null?oldNames.get(i+1):supplied.name();if(name==null||name.isBlank())name="第"+(i+1)+"级审核";
            List<String> reviewerIds=supplied==null||supplied.reviewerIds()==null||supplied.reviewerIds().isEmpty()?oldReviewers.getOrDefault(i+1,List.of()):supplied.reviewerIds().stream().distinct().toList();
            if(reviewerIds.isEmpty())throw new IllegalArgumentException("第"+(i+1)+"级至少配置一位审核人");
            String node=UUID.randomUUID().toString();jdbc.update("INSERT INTO qa_review_flow_node(id,flow_id,level_no,node_name) VALUES(?,?,?,?)",node,newId,i+1,name.trim());
            for(String uid:reviewerIds){Integer eligible=jdbc.queryForObject("SELECT COUNT(*) FROM sys_user u JOIN sys_user_role ur ON ur.user_id=u.id JOIN sys_role r ON r.id=ur.role_id WHERE u.id=? AND u.enabled=1 AND r.enabled=1 AND r.role_code IN (?,?,?)",Integer.class,uid,"QA_REVIEW_L"+(i+1),"QA_ADMIN","SYS_ADMIN");if(eligible==null||eligible==0)throw new IllegalArgumentException("第"+(i+1)+"级审核人没有对应审核权限或已禁用");jdbc.update("INSERT INTO qa_review_flow_reviewer(node_id,user_id) VALUES(?,?)",node,uid);}
        }
        jdbc.update("UPDATE qa_review_flow SET enabled=0 WHERE id=?",id);
        return get(newId);
    }
    private Object value(Map<String,Object> row,String key){return row.getOrDefault(key,row.get(key.toUpperCase(Locale.ROOT)));}
    public record FlowRequest(@NotBlank String passRule,Integer levelCount,List<NodeConfig> nodes){}
    public record NodeConfig(String name,List<String> reviewerIds){}
}
