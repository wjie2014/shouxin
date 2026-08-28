package com.shouxin.qa.qapair;

import com.shouxin.qa.auth.AuthUserService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import java.util.*;

/** Central ownership policy shared by content, attachments and review detail. */
@Service
public class PairAccess {
    private final JdbcTemplate jdbc;
    private final AuthUserService users;
    public PairAccess(JdbcTemplate jdbc, AuthUserService users) { this.jdbc=jdbc; this.users=users; }
    public Map<String,Object> require(String id, Authentication auth, boolean write) {
        var p=jdbc.queryForList("SELECT id,author_id,status,current_version_id FROM qa_pair WHERE id=? AND deleted=0",id)
            .stream().findFirst().orElseThrow(()->new NoSuchElementException("问答对不存在"));
        var u=users.findByUsername(auth.getName());
        boolean admin=u.roles().stream().anyMatch(r->Set.of("SYS_ADMIN","QA_ADMIN").contains(r));
        boolean assigned=!write && jdbc.queryForObject("SELECT COUNT(*) FROM qa_review_task t JOIN qa_pair_version v ON v.id=t.version_id WHERE v.qa_pair_id=? AND t.reviewer_id=?",Integer.class,id,u.id())>0;
        if (!admin && !u.id().equals(p.get("author_id")) && !assigned) throw new AccessDeniedException("无权访问该问答对");
        if(write && !Set.of("draft","updating","rejected_l1","rejected_l2","rejected_l3").contains(p.get("status")))
            throw new IllegalArgumentException("仅草稿、更新中或已驳回的问答对可以编辑");
        return p;
    }
}
