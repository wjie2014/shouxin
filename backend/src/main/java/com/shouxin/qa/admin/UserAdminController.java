package com.shouxin.qa.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api/admin/users") @PreAuthorize("hasRole('SYS_ADMIN')")
public class UserAdminController {
    private final JdbcTemplate jdbc; private final PasswordEncoder encoder;
    public UserAdminController(JdbcTemplate jdbc, PasswordEncoder encoder){this.jdbc=jdbc;this.encoder=encoder;}
    @GetMapping public List<Map<String,Object>> list(){return jdbc.queryForList("SELECT u.id,u.username,u.real_name,u.email,u.mobile,u.enabled,u.must_change_password,u.created_at,un.unit_name,LISTAGG(r.role_name,',') WITHIN GROUP (ORDER BY r.role_name) role_names,LISTAGG(r.role_code,',') WITHIN GROUP (ORDER BY r.role_code) role_codes FROM sys_user u LEFT JOIN sys_unit un ON un.id=u.unit_id LEFT JOIN sys_user_role ur ON ur.user_id=u.id LEFT JOIN sys_role r ON r.id=ur.role_id GROUP BY u.id,u.username,u.real_name,u.email,u.mobile,u.enabled,u.must_change_password,u.created_at,un.unit_name ORDER BY u.created_at DESC");}
    @PostMapping @Transactional public Map<String,Object> create(@Valid @RequestBody Create r){if(r.password().length()<8)throw new IllegalArgumentException("密码至少8位");if(jdbc.queryForObject("SELECT COUNT(*) FROM sys_user WHERE username=?",Integer.class,r.username())>0)throw new IllegalArgumentException("用户名已存在");String id=UUID.randomUUID().toString();jdbc.update("INSERT INTO sys_user(id,username,real_name,password_hash,email,mobile,unit_id) VALUES(?,?,?,?,?,?,?)",id,r.username(),r.realName(),encoder.encode(r.password()),r.email(),r.mobile(),r.unitId());setRoles(id,r.roleCodes());return jdbc.queryForMap("SELECT id,username,real_name,email,mobile,enabled FROM sys_user WHERE id=?",id);}
    @PutMapping("/{id}") @Transactional public void update(@PathVariable String id,@Valid @RequestBody Update r){if(jdbc.update("UPDATE sys_user SET real_name=?,email=?,mobile=?,unit_id=?,enabled=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",r.realName(),r.email(),r.mobile(),r.unitId(),r.enabled()?1:0,id)!=1)throw new NoSuchElementException("用户不存在");if(r.roleCodes()!=null)setRoles(id,r.roleCodes());}
    @DeleteMapping("/{id}") public void delete(@PathVariable String id){String username=jdbc.queryForList("SELECT username FROM sys_user WHERE id=?",String.class,id).stream().findFirst().orElseThrow(()->new NoSuchElementException("用户不存在"));if("admin".equals(username))throw new IllegalArgumentException("系统管理员账号不可删除");jdbc.update("UPDATE sys_user SET enabled=0,updated_at=CURRENT_TIMESTAMP WHERE id=?",id);}
    @PostMapping("/{id}/reset-password") public void resetPassword(@PathVariable String id,@Valid @RequestBody Password r){if(r.password().length()<8)throw new IllegalArgumentException("密码至少8位");if(jdbc.update("UPDATE sys_user SET password_hash=?,must_change_password=1,updated_at=CURRENT_TIMESTAMP WHERE id=?",encoder.encode(r.password()),id)!=1)throw new NoSuchElementException("用户不存在");}
    private void setRoles(String id,List<String> roles){jdbc.update("DELETE FROM sys_user_role WHERE user_id=?",id);if(roles!=null)for(String role:roles)jdbc.update("INSERT INTO sys_user_role(user_id,role_id) SELECT ?,id FROM sys_role WHERE role_code=? AND enabled=1",id,role);}
    public record Create(@NotBlank String username,@NotBlank String realName,@NotBlank String password,String email,String mobile,String unitId,List<String> roleCodes){}
    public record Update(@NotBlank String realName,String email,String mobile,String unitId,boolean enabled,List<String> roleCodes){}
    public record Password(@NotBlank String password){}
}
