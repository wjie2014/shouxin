package com.shouxin.qa.field;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin/field-schemes")
@PreAuthorize("hasAuthority('config:fields')")
public class FieldSchemeAdminController {
    private final JdbcTemplate jdbc;
    private final FieldSchemeService service;
    public FieldSchemeAdminController(JdbcTemplate jdbc,FieldSchemeService service){this.jdbc=jdbc;this.service=service;}

    @PostMapping @Transactional
    public Map<String,Object> create(@Valid @RequestBody Req request){validateCode(request.code(),"方案编码");String id=UUID.randomUUID().toString();jdbc.update("INSERT INTO qa_field_scheme(id,scheme_code,scheme_name,description,is_default,enabled) VALUES(?,?,?,?,0,1)",id,request.code().trim(),request.name().trim(),request.description());return service.scheme(id);}
    @PutMapping("/{id}") @Transactional
    public void update(@PathVariable String id,@Valid @RequestBody Req request){if(jdbc.update("UPDATE qa_field_scheme SET scheme_name=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND enabled=1",request.name().trim(),request.description(),id)!=1)throw new NoSuchElementException("字段方案不存在");}
    @DeleteMapping("/{id}") @Transactional
    public void delete(@PathVariable String id){if(jdbc.update("UPDATE qa_field_scheme SET enabled=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND is_default=0",id)!=1)throw new IllegalArgumentException("默认方案不可删除或方案不存在");}

    @PostMapping("/{id}/default") @Transactional
    public void makeDefault(@PathVariable String id){Integer count=jdbc.queryForObject("SELECT COUNT(*) FROM qa_field_scheme WHERE id=? AND enabled=1",Integer.class,id);if(count==null||count!=1)throw new NoSuchElementException("字段方案不存在");jdbc.update("UPDATE qa_field_scheme SET is_default=0 WHERE is_default=1");jdbc.update("UPDATE qa_field_scheme SET is_default=1,updated_at=CURRENT_TIMESTAMP WHERE id=?",id);}

    @PostMapping("/{id}/copy") @Transactional
    public Map<String,Object> copy(@PathVariable String id,@RequestBody(required=false) CopyReq request){Map<String,Object> source=service.scheme(id);String target=UUID.randomUUID().toString();String code=request==null||request.code()==null||request.code().isBlank()?String.valueOf(source.get("scheme_code"))+"_COPY_"+System.currentTimeMillis():request.code().trim();validateCode(code,"方案编码");String name=request==null||request.name()==null||request.name().isBlank()?String.valueOf(source.get("scheme_name"))+"（副本）":request.name().trim();jdbc.update("INSERT INTO qa_field_scheme(id,scheme_code,scheme_name,description,is_default,enabled) VALUES(?,?,?,?,0,1)",target,code,name,source.get("description"));for(Map<String,Object> field:service.fields(id))insertField(target,fieldFrom(field));return service.scheme(target);}

    @GetMapping("/{id}/export") public Map<String,Object> exportScheme(@PathVariable String id){return service.scheme(id);}
    @PostMapping("/import") @Transactional
    public Map<String,Object> importScheme(@RequestBody Map<String,Object> body){String code=text(body,"scheme_code"),name=text(body,"scheme_name");if(code.isBlank()||name.isBlank())throw new IllegalArgumentException("导入文件缺少方案编码或名称");validateCode(code,"方案编码");Object raw=body.get("fields");if(!(raw instanceof Collection<?> fields)||fields.isEmpty())throw new IllegalArgumentException("导入方案至少包含一个字段");if(fields.size()>100)throw new IllegalArgumentException("单个方案最多导入100个字段");Set<String> codes=new HashSet<>();List<FieldReq> requests=new ArrayList<>();for(Object item:fields){if(!(item instanceof Map<?,?> map))throw new IllegalArgumentException("字段配置必须是JSON对象");FieldReq request=fieldFrom(map);if(!codes.add(request.code()))throw new IllegalArgumentException("字段编码重复："+request.code());validate(request);requests.add(request);}String id=UUID.randomUUID().toString();jdbc.update("INSERT INTO qa_field_scheme(id,scheme_code,scheme_name,description,is_default,enabled) VALUES(?,?,?,?,0,1)",id,code,name,body.get("description"));for(FieldReq request:requests)insertField(id,request);return service.scheme(id);}

    @PostMapping("/{id}/fields") @Transactional
    public Map<String,Object> addField(@PathVariable String id,@Valid @RequestBody FieldReq request){return insertField(id,request);}
    private Map<String,Object> insertField(String id,FieldReq request){validate(request);String fieldId=UUID.randomUUID().toString();jdbc.update("INSERT INTO qa_field_config(id,scheme_id,field_code,field_name,field_type,required,list_visible,searchable,sort_order,options_json,column_width,align_mode,sortable) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",fieldId,id,request.code().trim(),request.name().trim(),service.normalizeType(request.type()),flag(request.required()),flag(request.listVisible()),flag(request.searchable()),positive(request.sortOrder(),1),blank(request.optionsJson()),width(request.columnWidth()),align(request.align()),flag(request.sortable()));return service.fields(id).stream().filter(x->fieldId.equals(x.get("id"))).findFirst().orElseThrow();}

    @PutMapping("/{id}/fields/{fieldId}") @Transactional
    public void updateField(@PathVariable String id,@PathVariable String fieldId,@Valid @RequestBody FieldReq request){validate(request);if(jdbc.update("UPDATE qa_field_config SET field_name=?,field_type=?,required=?,list_visible=?,searchable=?,sort_order=?,options_json=?,column_width=?,align_mode=?,sortable=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND scheme_id=?",request.name().trim(),service.normalizeType(request.type()),flag(request.required()),flag(request.listVisible()),flag(request.searchable()),positive(request.sortOrder(),1),blank(request.optionsJson()),width(request.columnWidth()),align(request.align()),flag(request.sortable()),fieldId,id)!=1)throw new NoSuchElementException("字段不存在");}
    @DeleteMapping("/{id}/fields/{fieldId}") @Transactional public void deleteField(@PathVariable String id,@PathVariable String fieldId){if(jdbc.update("DELETE FROM qa_field_config WHERE id=? AND scheme_id=?",fieldId,id)!=1)throw new NoSuchElementException("字段不存在");}

    @PostMapping("/{id}/fields/{fieldId}/move") @Transactional
    public void move(@PathVariable String id,@PathVariable String fieldId,@RequestParam String direction){List<Map<String,Object>> fields=new ArrayList<>(service.fields(id));int index=-1;for(int i=0;i<fields.size();i++)if(fieldId.equals(String.valueOf(fields.get(i).get("id"))))index=i;if(index<0)throw new NoSuchElementException("字段不存在");int target="UP".equalsIgnoreCase(direction)?index-1:index+1;if(target<0||target>=fields.size())return;Collections.swap(fields,index,target);for(int i=0;i<fields.size();i++)jdbc.update("UPDATE qa_field_config SET sort_order=? WHERE id=?",i+1,fields.get(i).get("id"));}

    private void validate(FieldReq request){validateCode(request.code(),"字段编码");service.requireSupportedType(request.type());service.validateOptions(request.type(),request.optionsJson());}
    private void validateCode(String value,String label){if(value==null||!value.matches("[A-Za-z][A-Za-z0-9_-]{0,63}"))throw new IllegalArgumentException(label+"必须以字母开头，且只能包含字母、数字、下划线和连字符（最长64位）");}
    private FieldReq fieldFrom(Map<?,?> map){return new FieldReq(value(map,"field_code"),value(map,"field_name"),value(map,"field_type"),bool(map,"required"),bool(map,"list_visible"),bool(map,"searchable"),integer(map,"sort_order",1),nullable(map,"options_json"),integer(map,"column_width",160),valueDefault(map,"align_mode","LEFT"),bool(map,"sortable"));}
    private String text(Map<String,Object> map,String key){Object v=map.get(key);return v==null?"":String.valueOf(v).trim();}
    private Object find(Map<?,?> map,String key){if(map.containsKey(key))return map.get(key);if(map.containsKey(key.toUpperCase(Locale.ROOT)))return map.get(key.toUpperCase(Locale.ROOT));return null;}
    private String value(Map<?,?> map,String key){Object v=find(map,key);return v==null?"":String.valueOf(v);}
    private String valueDefault(Map<?,?> map,String key,String fallback){String result=value(map,key);return result.isBlank()?fallback:result;}
    private String nullable(Map<?,?> map,String key){String result=value(map,key);return result.isBlank()?null:result;}
    private boolean bool(Map<?,?> map,String key){Object v=find(map,key);return v instanceof Boolean b?b:v instanceof Number n?n.intValue()==1:"true".equalsIgnoreCase(String.valueOf(v));}
    private int integer(Map<?,?> map,String key,int fallback){Object v=find(map,key);try{return v instanceof Number n?n.intValue():Integer.parseInt(String.valueOf(v));}catch(Exception e){return fallback;}}
    private int flag(boolean value){return value?1:0;}private int positive(int value,int fallback){return value>0?value:fallback;}private int width(Integer value){return Math.max(80,Math.min(600,value==null?160:value));}
    private String align(String value){String result=value==null?"LEFT":value.toUpperCase(Locale.ROOT);return Set.of("LEFT","CENTER","RIGHT").contains(result)?result:"LEFT";}private String blank(String value){return value==null||value.isBlank()?null:value;}

    public record Req(@NotBlank String code,@NotBlank String name,String description){}
    public record CopyReq(String code,String name){}
    public record FieldReq(@NotBlank String code,@NotBlank String name,@NotBlank String type,boolean required,boolean listVisible,boolean searchable,int sortOrder,String optionsJson,Integer columnWidth,String align,boolean sortable){}
}
