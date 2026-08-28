package com.shouxin.qa.admin;
import org.springframework.jdbc.core.JdbcTemplate;import org.springframework.security.access.prepost.PreAuthorize;import org.springframework.transaction.annotation.Transactional;import org.springframework.web.bind.annotation.*;import java.util.*;
@RestController @RequestMapping("/api/admin/config") @PreAuthorize("hasRole('SYS_ADMIN')")
public class SystemConfigController{
 private final JdbcTemplate jdbc;public SystemConfigController(JdbcTemplate jdbc){this.jdbc=jdbc;}
 @GetMapping public List<Map<String,Object>> list(){return jdbc.queryForList("SELECT config_key,config_value,config_type,description,updated_at FROM sys_config ORDER BY config_key");}
 @PostMapping @Transactional public void create(@RequestBody Config r){if(r.key()==null||r.key().isBlank())throw new IllegalArgumentException("参数名不能为空");jdbc.update("INSERT INTO sys_config(config_key,config_value,config_type,description) VALUES(?,?,?,?)",r.key(),r.value(),type(r),r.description());}
 @PutMapping("/{key}") @Transactional public void set(@PathVariable String key,@RequestBody Config r){if(jdbc.update("UPDATE sys_config SET config_value=?,config_type=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE config_key=?",r.value(),type(r),r.description(),key)!=1)throw new NoSuchElementException("配置项不存在");}
 @DeleteMapping("/{key}") @Transactional public void delete(@PathVariable String key){if(jdbc.update("DELETE FROM sys_config WHERE config_key=?",key)!=1)throw new NoSuchElementException("配置项不存在");}
 private String type(Config r){return r.type()==null||r.type().isBlank()?"STRING":r.type();}public record Config(String key,String value,String type,String description){}
}
