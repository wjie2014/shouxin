package com.shouxin.qa.audit;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin/operation-logs")
@PreAuthorize("hasAuthority('system:logs')")
public class OperationLogController {
    private final JdbcTemplate jdbc;
    public OperationLogController(JdbcTemplate jdbc){this.jdbc=jdbc;}

    @GetMapping
    public Map<String,Object> list(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="10") int pageSize,
                                   @RequestParam(required=false) String type,@RequestParam(required=false) String operator,
                                   @RequestParam(required=false) String keyword,@RequestParam(required=false) String from,@RequestParam(required=false) String to,
                                   @RequestParam(defaultValue="desc") String sortDir){
        int size=Math.min(Math.max(pageSize,1),200),safePage=Math.max(page,1),offset=(safePage-1)*size;
        StringBuilder base=new StringBuilder(" FROM sys_operation_log l LEFT JOIN sys_user u ON u.id=l.operator_id WHERE 1=1");List<Object> args=new ArrayList<>();
        if(type!=null&&!type.isBlank()){base.append(" AND l.operation_type=?");args.add(type);}
        if(operator!=null&&!operator.isBlank()){base.append(" AND (u.real_name LIKE ? OR u.username LIKE ?)");String like="%"+operator.trim()+"%";args.add(like);args.add(like);}
        if(keyword!=null&&!keyword.isBlank()){base.append(" AND l.operation_content LIKE ?");args.add("%"+keyword.trim()+"%");}
        if(from!=null&&!from.isBlank()){base.append(" AND l.created_at>=TO_TIMESTAMP(?,'YYYY-MM-DD HH24:MI:SS')");args.add(from+" 00:00:00");}
        if(to!=null&&!to.isBlank()){base.append(" AND l.created_at<=TO_TIMESTAMP(?,'YYYY-MM-DD HH24:MI:SS')");args.add(to+" 23:59:59");}
        Integer total=jdbc.queryForObject("SELECT COUNT(*)"+base,Integer.class,args.toArray());
        String sql="SELECT l.id,l.operation_type,l.operation_content,l.target_type,l.target_id,l.client_ip,l.created_at,u.real_name,u.username"+base+" ORDER BY l.created_at "+("asc".equalsIgnoreCase(sortDir)?"ASC":"DESC")+" LIMIT ? OFFSET ?";args.add(size);args.add(offset);
        return Map.of("items",jdbc.queryForList(sql,args.toArray()),"total",total==null?0:total,"page",safePage,"pageSize",size);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SYS_ADMIN')")
    public void delete(@PathVariable String id){if(jdbc.update("DELETE FROM sys_operation_log WHERE id=?",id)!=1)throw new NoSuchElementException("日志不存在");}
}
