package com.shouxin.qa.field;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class FieldSchemeService {
    public static final Set<String> TYPES = Set.of("TEXT", "TEXTAREA", "RICH_TEXT", "INTEGER", "DECIMAL", "DATE", "DATETIME", "SINGLE_ENUM", "MULTI_ENUM", "CASCADE", "ATTACHMENT", "USER", "BOOLEAN");
    private static final Set<String> CORE_FIELDS = Set.of("questionText", "answerText", "referenceDoc", "author", "attachments", "domainL1Id", "domainL2Id", "domainL3Id");
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public FieldSchemeService(JdbcTemplate jdbc, ObjectMapper mapper) { this.jdbc = jdbc; this.mapper = mapper; }

    public Map<String, Object> defaultScheme() {
        return jdbc.queryForList("SELECT id,scheme_code,scheme_name,description,is_default,enabled FROM qa_field_scheme WHERE enabled=1 ORDER BY is_default DESC,created_at")
                .stream().findFirst().orElseThrow(() -> new IllegalStateException("尚未配置可用字段方案"));
    }

    public Map<String, Object> scheme(String requestedId) {
        String id = requestedId == null || requestedId.isBlank() ? string(defaultScheme(), "id") : requestedId;
        Map<String, Object> scheme = jdbc.queryForList("SELECT id,scheme_code,scheme_name,description,is_default,enabled FROM qa_field_scheme WHERE id=? AND enabled=1", id)
                .stream().findFirst().orElseThrow(() -> new IllegalArgumentException("字段方案不存在或已停用"));
        Map<String, Object> result = new LinkedHashMap<>(lowerKeys(scheme));
        result.put("fields", fields(id));
        return result;
    }

    public List<Map<String, Object>> fields(String schemeId) {
        return jdbc.queryForList("SELECT id,field_code,field_name,field_type,required,list_visible,searchable,sort_order,options_json,column_width,align_mode,sortable FROM qa_field_config WHERE scheme_id=? ORDER BY sort_order,id", schemeId)
                .stream().map(this::lowerKeys).toList();
    }

    public Resolved resolve(String requestedId, String extensionJson, Map<String, Object> core, boolean strict) {
        Map<String, Object> scheme = scheme(requestedId);
        return resolveAgainst(scheme, extensionJson, core, strict);
    }

    public Resolved resolveExisting(String requestedId, String snapshotJson, String extensionJson, Map<String, Object> core, boolean strict) {
        if (snapshotJson != null && !snapshotJson.isBlank()) {
            try {
                Map<String,Object> snapshot=mapper.readValue(snapshotJson,new TypeReference<Map<String,Object>>(){});
                if(requestedId==null||requestedId.isBlank()||requestedId.equals(string(snapshot,"id"))) return resolveAgainst(snapshot,extensionJson,core,strict);
            } catch (Exception ignored) { }
        }
        return resolve(requestedId,extensionJson,core,strict);
    }

    private Resolved resolveAgainst(Map<String,Object> scheme, String extensionJson, Map<String,Object> core, boolean strict) {
        Map<String, Object> extensions = parseObject(extensionJson);
        Set<String> allowed = new LinkedHashSet<>();
        for (Map<String, Object> field : castFields(scheme.get("fields"))) {
            String code = string(field, "field_code");
            String name = string(field, "field_name");
            String type = normalizeType(string(field, "field_type"));
            boolean required = number(field, "required") == 1;
            Object raw = CORE_FIELDS.contains(code) ? core.get(code) : extensions.get(code);
            if (required && strict && empty(raw)) throw new IllegalArgumentException(name + "不能为空");
            if (!CORE_FIELDS.contains(code)) {
                allowed.add(code);
                if (!empty(raw)) extensions.put(code, normalizeValue(name, type, raw, field.get("options_json")));
            }
        }
        extensions.keySet().removeIf(key -> !allowed.contains(key));
        try {
            return new Resolved(string(scheme, "id"), mapper.writeValueAsString(scheme), mapper.writeValueAsString(extensions));
        } catch (Exception e) { throw new IllegalArgumentException("扩展字段数据格式无效", e); }
    }

    public void validateSubmit(String versionId) {
        Map<String, Object> row = jdbc.queryForMap("SELECT v.field_scheme_id,v.field_schema_snapshot,v.extension_data,v.question_text,v.answer_text,v.reference_doc,p.author_id FROM qa_pair_version v JOIN qa_pair p ON p.id=v.qa_pair_id WHERE v.id=?", versionId);
        String schemeId = nullableString(row, "field_scheme_id");
        if (schemeId == null) return;
        int attachments = Optional.ofNullable(jdbc.queryForObject("SELECT COUNT(*) FROM qa_attachment WHERE version_id=?", Integer.class, versionId)).orElse(0);
        Map<String, Object> core = Map.of("questionText", value(row,"question_text"), "answerText", value(row,"answer_text"), "referenceDoc", Optional.ofNullable(value(row,"reference_doc")).orElse(""), "author", value(row,"author_id"), "attachments", attachments == 0 ? "" : attachments);
        String extensionJson=attachmentAwareExtensions(nullableString(row,"field_schema_snapshot"),nullableString(row,"extension_data"),attachments);
        resolveExisting(schemeId, nullableString(row,"field_schema_snapshot"), extensionJson, core, true);
    }

    private String attachmentAwareExtensions(String snapshotJson,String extensionJson,int attachmentCount){
        Map<String,Object> values=parseObject(extensionJson);
        if(snapshotJson==null||snapshotJson.isBlank())return extensionJson;
        try{
            Map<String,Object> snapshot=mapper.readValue(snapshotJson,new TypeReference<Map<String,Object>>(){});
            for(Map<String,Object> field:castFields(snapshot.get("fields"))){
                String code=string(field,"field_code");
                if("ATTACHMENT".equals(normalizeType(string(field,"field_type")))&&!CORE_FIELDS.contains(code)){
                    if(attachmentCount==0)values.remove(code);
                    else if(empty(values.get(code)))values.put(code,List.of(Map.of("uploaded",true,"count",attachmentCount)));
                }
            }
            return mapper.writeValueAsString(values);
        }catch(Exception e){throw new IllegalArgumentException("字段方案快照或附件数据无效");}
    }

    public String snapshot(String schemeId) {
        try { return mapper.writeValueAsString(scheme(schemeId)); }
        catch (Exception e) { throw new IllegalArgumentException("字段方案快照生成失败", e); }
    }

    public String normalizeType(String type) {
        String normalized = type == null ? "TEXT" : type.toUpperCase(Locale.ROOT);
        return switch (normalized) { case "ENUM" -> "SINGLE_ENUM"; case "NUMBER" -> "DECIMAL"; default -> normalized; };
    }

    public void requireSupportedType(String type) { if (!TYPES.contains(normalizeType(type))) throw new IllegalArgumentException("不支持的字段类型：" + type); }

    public void validateOptions(String type, String optionsJson) {
        String normalized = normalizeType(type);
        if (!Set.of("SINGLE_ENUM", "MULTI_ENUM", "CASCADE").contains(normalized)) return;
        if (optionsJson == null || optionsJson.isBlank()) throw new IllegalArgumentException("该字段类型必须配置选项");
        try {
            Object parsed=mapper.readValue(optionsJson,Object.class);
            Object source=parsed instanceof Map<?,?> map&&map.containsKey("options")?map.get("options"):parsed;
            if(!(source instanceof Collection<?> values)||values.isEmpty())throw new IllegalArgumentException("至少配置一个有效选项");
            if("CASCADE".equals(normalized))validateCascade(values,1);
        } catch (IllegalArgumentException e){throw e;}
        catch (Exception e) { throw new IllegalArgumentException("选项配置不是有效JSON"); }
    }

    private Object normalizeValue(String name, String type, Object raw, Object optionsJson) {
        try {
            return switch (type) {
                case "INTEGER" -> raw instanceof Number n ? n.longValue() : Long.parseLong(String.valueOf(raw));
                case "DECIMAL" -> new BigDecimal(String.valueOf(raw));
                case "DATE" -> LocalDate.parse(String.valueOf(raw)).toString();
                case "DATETIME" -> LocalDateTime.parse(String.valueOf(raw)).toString();
                case "BOOLEAN" -> raw instanceof Boolean b ? b : Set.of("true", "1", "是", "yes").contains(String.valueOf(raw).toLowerCase(Locale.ROOT));
                case "SINGLE_ENUM" -> validateEnum(name, raw, optionsJson, false);
                case "MULTI_ENUM" -> validateEnum(name, raw, optionsJson, true);
                case "CASCADE" -> validateCascadeValue(name,raw,optionsJson);
                case "USER" -> validateUser(name,raw);
                case "ATTACHMENT" -> validateAttachment(name,raw);
                default -> raw;
            };
        } catch (IllegalArgumentException e) { throw e; }
        catch (Exception e) { throw new IllegalArgumentException(name + "的值与字段类型不匹配"); }
    }

    private Object validateUser(String name,Object raw){String id=String.valueOf(raw);Integer count=jdbc.queryForObject("SELECT COUNT(*) FROM sys_user WHERE id=? AND enabled=1",Integer.class,id);if(count==null||count==0)throw new IllegalArgumentException(name+"选择的用户不存在或已停用");return id;}
    private Object validateAttachment(String name,Object raw){if(!(raw instanceof Collection<?>))throw new IllegalArgumentException(name+"必须是附件列表");return raw;}
    private Object validateCascadeValue(String name,Object raw,Object optionsJson){List<String> path=toStringList(raw);if(path.isEmpty())return path;try{Object parsed=mapper.readValue(String.valueOf(optionsJson),Object.class);Object source=parsed instanceof Map<?,?> map?map.get("options"):parsed;if(!(source instanceof Collection<?> nodes))throw new IllegalArgumentException(name+"的级联选项无效");Collection<?> current=nodes;for(String selected:path){Map<?,?> matched=null;for(Object item:current)if(item instanceof Map<?,?> candidate){Object candidateValue=candidate.containsKey("value")?candidate.get("value"):candidate.get("label");if(selected.equals(String.valueOf(candidateValue))){matched=candidate;break;}}if(matched==null)throw new IllegalArgumentException(name+"包含无效级联选项");Object children=matched.get("children");current=children instanceof Collection<?> collection?collection:List.of();}return path;}catch(IllegalArgumentException e){throw e;}catch(Exception e){throw new IllegalArgumentException(name+"的级联选项无效");}}
    private void validateCascade(Collection<?> nodes,int level){if(level>6)throw new IllegalArgumentException("级联选项最多支持6级");for(Object node:nodes){if(!(node instanceof Map<?,?> map)||(!map.containsKey("value")&&!map.containsKey("label")))throw new IllegalArgumentException("级联选项必须包含 value 或 label");Object children=map.get("children");if(children!=null){if(!(children instanceof Collection<?> collection))throw new IllegalArgumentException("级联 children 必须是数组");validateCascade(collection,level+1);}}}

    private Object validateEnum(String name, Object raw, Object optionsJson, boolean multiple) {
        Set<String> allowed = enumValues(optionsJson == null ? null : String.valueOf(optionsJson));
        List<String> values = multiple ? toStringList(raw) : List.of(String.valueOf(raw));
        if (!allowed.isEmpty() && values.stream().anyMatch(value -> !allowed.contains(value))) throw new IllegalArgumentException(name + "包含无效选项");
        return multiple ? values : values.get(0);
    }

    private Set<String> enumValues(String json) {
        if (json == null || json.isBlank()) return Set.of();
        try {
            Object parsed = mapper.readValue(json, Object.class);
            Object source = parsed instanceof Map<?,?> map && map.containsKey("options") ? map.get("options") : parsed;
            if (!(source instanceof Collection<?> collection)) return Set.of();
            Set<String> result = new LinkedHashSet<>();
            for (Object item : collection) {
                if (item instanceof Map<?,?> map) { Object option=map.containsKey("value")?map.get("value"):map.get("label");result.add(String.valueOf(option)); }
                else result.add(String.valueOf(item));
            }
            return result;
        } catch (Exception e) { throw new IllegalArgumentException("枚举选项配置无效"); }
    }

    private List<String> toStringList(Object value) {
        if (value instanceof Collection<?> c) return c.stream().map(String::valueOf).toList();
        String text = String.valueOf(value);
        if (text.startsWith("[") && text.endsWith("]")) try { return mapper.readValue(text, new TypeReference<List<String>>(){}); } catch (Exception ignored) { }
        return Arrays.stream(text.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private Map<String, Object> parseObject(String json) {
        if (json == null || json.isBlank()) return new LinkedHashMap<>();
        try { return new LinkedHashMap<>(mapper.readValue(json, new TypeReference<Map<String,Object>>(){})); }
        catch (Exception e) { throw new IllegalArgumentException("扩展字段必须是JSON对象"); }
    }
    @SuppressWarnings("unchecked") private List<Map<String,Object>> castFields(Object value) { return value instanceof List<?> list ? (List<Map<String,Object>>) list : List.of(); }
    private boolean empty(Object value) { return value == null || String.valueOf(value).isBlank() || value instanceof Collection<?> c && c.isEmpty(); }
    private Map<String,Object> lowerKeys(Map<String,Object> row) { Map<String,Object> result=new LinkedHashMap<>();row.forEach((k,v)->result.put(k.toLowerCase(Locale.ROOT),v));return result; }
    private Object value(Map<String,Object> row,String key){return row.containsKey(key)?row.get(key):row.get(key.toUpperCase(Locale.ROOT));}
    private String string(Map<String,Object> row,String key){Object v=value(row,key);return v==null?"":String.valueOf(v);}
    private String nullableString(Map<String,Object> row,String key){String v=string(row,key);return v.isBlank()?null:v;}
    private int number(Map<String,Object> row,String key){Object v=value(row,key);return v instanceof Number n?n.intValue():0;}

    public record Resolved(String schemeId, String snapshotJson, String extensionJson) {}
}
