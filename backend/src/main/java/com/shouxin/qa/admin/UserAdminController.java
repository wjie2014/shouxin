package com.shouxin.qa.admin;

import com.shouxin.qa.audit.OperationLogService;
import com.shouxin.qa.auth.AuthUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import java.util.*;

@RestController @RequestMapping("/api/admin/users")
public class UserAdminController {
    private final JdbcTemplate jdbc; private final PasswordEncoder encoder; private final AuthUserService users; private final OperationLogService logs;
    public UserAdminController(JdbcTemplate jdbc, PasswordEncoder encoder, AuthUserService users, OperationLogService logs){this.jdbc=jdbc;this.encoder=encoder;this.users=users;this.logs=logs;}
    @GetMapping
    @PreAuthorize("hasAuthority('system:users')")
    public List<Map<String,Object>> list(){return jdbc.queryForList("SELECT u.id,u.username,u.real_name,u.email,u.mobile,u.unit_id,u.enabled,u.must_change_password,u.created_at,un.unit_name,LISTAGG(r.role_name,',') WITHIN GROUP (ORDER BY r.role_name) role_names,LISTAGG(r.role_code,',') WITHIN GROUP (ORDER BY r.role_code) role_codes FROM sys_user u LEFT JOIN sys_unit un ON un.id=u.unit_id LEFT JOIN sys_user_role ur ON ur.user_id=u.id LEFT JOIN sys_role r ON r.id=ur.role_id GROUP BY u.id,u.username,u.real_name,u.email,u.mobile,u.unit_id,u.enabled,u.must_change_password,u.created_at,un.unit_name ORDER BY u.created_at DESC");}
    @GetMapping("/reviewer-options")
    @PreAuthorize("isAuthenticated()")
    public List<Map<String,Object>> reviewerOptions(){return jdbc.queryForList("SELECT u.id,u.username,u.real_name,LISTAGG(r.role_name,',') WITHIN GROUP (ORDER BY r.role_name) role_names FROM sys_user u JOIN sys_user_role ur ON ur.user_id=u.id JOIN sys_role r ON r.id=ur.role_id AND r.enabled=1 WHERE u.enabled=1 AND r.role_code IN ('QA_REVIEW_L1','QA_REVIEW_L2','QA_REVIEW_L3','QA_ADMIN','SYS_ADMIN') GROUP BY u.id,u.username,u.real_name ORDER BY u.real_name");}
    @GetMapping("/unit-options")
    @PreAuthorize("hasAuthority('system:users')")
    public List<Map<String,Object>> unitOptions(){return jdbc.queryForList("SELECT id,unit_code,unit_name,parent_id FROM sys_unit WHERE enabled=1 ORDER BY sort_order,unit_name");}
    @PostMapping @PreAuthorize("hasAuthority('system:users')") @Transactional public Map<String,Object> create(@Valid @RequestBody Create r){if(r.password().length()<8)throw new IllegalArgumentException("密码至少8位");if(jdbc.queryForObject("SELECT COUNT(*) FROM sys_user WHERE username=?",Integer.class,r.username())>0)throw new IllegalArgumentException("用户名已存在");String unitId=normalizeUnit(r.unitId());validateUnit(unitId);validateRoles(r.roleCodes());String id=UUID.randomUUID().toString();jdbc.update("INSERT INTO sys_user(id,username,real_name,password_hash,email,mobile,unit_id) VALUES(?,?,?,?,?,?,?)",id,r.username(),r.realName(),encoder.encode(r.password()),r.email(),r.mobile(),unitId);setRoles(id,r.roleCodes());return jdbc.queryForMap("SELECT id,username,real_name,email,mobile,enabled FROM sys_user WHERE id=?",id);}
    @PutMapping("/{id}") @PreAuthorize("hasAuthority('system:users')") @Transactional public Map<String,Object> update(@PathVariable String id,@Valid @RequestBody Update r){String unitId=normalizeUnit(r.unitId());validateUnit(unitId);validateRoles(r.roleCodes());if(jdbc.update("UPDATE sys_user SET real_name=?,email=?,mobile=?,unit_id=?,enabled=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",r.realName(),r.email(),r.mobile(),unitId,r.enabled()?1:0,id)!=1)throw new NoSuchElementException("用户不存在");if(r.roleCodes()!=null)setRoles(id,r.roleCodes());return jdbc.queryForMap("SELECT id,username,real_name,email,mobile,unit_id,enabled,must_change_password,updated_at FROM sys_user WHERE id=?",id);}
    @DeleteMapping("/{id}") @PreAuthorize("hasAuthority('system:users')") public void delete(@PathVariable String id){String username=jdbc.queryForList("SELECT username FROM sys_user WHERE id=?",String.class,id).stream().findFirst().orElseThrow(()->new NoSuchElementException("用户不存在"));if("admin".equals(username))throw new IllegalArgumentException("系统管理员账号不可删除");jdbc.update("UPDATE sys_user SET enabled=0,updated_at=CURRENT_TIMESTAMP WHERE id=?",id);}
    @PostMapping("/{id}/reset-password") @PreAuthorize("hasAuthority('system:users')") @Transactional
    public Map<String,Object> resetPassword(@PathVariable String id,@Valid @RequestBody Password r, Authentication authentication){
        if(r.password().length()<8)throw new IllegalArgumentException("密码至少8位");
        List<Map<String,Object>> target=jdbc.queryForList("SELECT username,enabled FROM sys_user WHERE id=?",id);
        if(target.isEmpty())throw new NoSuchElementException("用户不存在");
        if(Number.class.cast(target.get(0).getOrDefault("enabled",target.get(0).get("ENABLED"))).intValue()!=1)throw new IllegalArgumentException("已停用用户不能重置密码");
        jdbc.update("UPDATE sys_user SET password_hash=?,must_change_password=1,auth_version=auth_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?",encoder.encode(r.password()),id);
        String username=String.valueOf(target.get(0).getOrDefault("username",target.get(0).get("USERNAME")));
        logs.record(users.findByUsername(authentication.getName()).id(),"RESET_USER_PASSWORD","重置用户密码："+username,"USER",id);
        return Map.of("id",id,"username",username,"mustChangePassword",true,"message","密码重置成功，用户原有登录已失效");
    }
    private void setRoles(String id,List<String> roles){jdbc.update("DELETE FROM sys_user_role WHERE user_id=?",id);if(roles!=null)for(String role:roles)jdbc.update("INSERT INTO sys_user_role(user_id,role_id) SELECT ?,id FROM sys_role WHERE role_code=? AND enabled=1",id,role);}
    private String normalizeUnit(String id){return id==null||id.isBlank()?null:id.trim();}
    private void validateUnit(String id){if(id!=null&&!id.isBlank()&&jdbc.queryForObject("SELECT COUNT(*) FROM sys_unit WHERE id=? AND enabled=1",Integer.class,id)!=1)throw new IllegalArgumentException("单位不存在或已停用");}
    private void validateRoles(List<String> roles){if(roles==null||roles.isEmpty())throw new IllegalArgumentException("请至少选择一个角色");for(String role:roles)if(role==null||role.isBlank()||jdbc.queryForObject("SELECT COUNT(*) FROM sys_role WHERE role_code=? AND enabled=1",Integer.class,role)!=1)throw new IllegalArgumentException("角色不存在或已停用："+role);}
    public record Create(@NotBlank String username,@NotBlank String realName,@NotBlank String password,String email,String mobile,String unitId,List<String> roleCodes){}
    public record Update(@NotBlank String realName,String email,String mobile,String unitId,boolean enabled,List<String> roleCodes){}
    public record Password(@NotBlank String password){}
}
