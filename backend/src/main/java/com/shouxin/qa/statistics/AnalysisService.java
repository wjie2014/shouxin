package com.shouxin.qa.statistics;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shouxin.qa.auth.AuthUser;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class AnalysisService {
    private static final Set<String> MODES = Set.of("trend", "distribution", "cross", "efficiency", "funnel", "overdue", "reviewerRanking", "behavior");
    private static final Map<String, String> DIMENSIONS = Map.ofEntries(
            Map.entry("status", "p.status"), Map.entry("domainL1", "d1.domain_name"),
            Map.entry("domainL2", "d2.domain_name"), Map.entry("domainL3", "COALESCE(d3.domain_name,'未配置')"),
            Map.entry("author", "u.real_name"), Map.entry("version", "v.version_no"),
            Map.entry("yearMonth", "TO_CHAR(p.created_at,'YYYY-MM')"));
    private static final Map<String, String> TIME_FIELDS = Map.of(
            "createdAt", "p.created_at", "submittedAt", "v.submitted_at",
            "publishedAt", "v.published_at", "retiredAt", "v.retired_at");

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public AnalysisService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public Map<String, Object> options() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("domains", jdbc.queryForList("SELECT id,parent_id,domain_name,level_no FROM qa_domain WHERE deleted=0 AND enabled=1 ORDER BY level_no,sort_order,domain_name"));
        result.put("users", jdbc.queryForList("SELECT id,username,real_name FROM sys_user WHERE enabled=1 ORDER BY real_name"));
        result.put("customFields", jdbc.queryForList("SELECT DISTINCT field_code,field_name,field_type FROM qa_field_config WHERE searchable=1 OR list_visible=1 ORDER BY field_name"));
        result.put("statuses", List.of("draft", "pending_review_l1", "pending_review_l2", "pending_review_l3", "rejected_l1", "rejected_l2", "rejected_l3", "published", "updating", "retired"));
        return result;
    }

    public Map<String, Object> analyze(AnalysisRequest raw, AuthUser user) {
        AnalysisRequest request = normalize(raw);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mode", request.mode());
        result.put("summary", summary(request, user));
        List<Map<String, Object>> chart = switch (request.mode()) {
            case "trend" -> trend(request, user);
            case "cross" -> cross(request, user);
            case "efficiency", "reviewerRanking" -> efficiency(request, user);
            case "funnel" -> funnel(request, user);
            case "overdue" -> overdue(request, user);
            case "behavior" -> behavior(request, user);
            default -> distribution(request, user);
        };
        result.put("items", chart);
        if (request.comparePreviousPeriod() && request.dateRange() != null && validDate(request.dateRange().from()) && validDate(request.dateRange().to())) {
            AnalysisRequest previous = previousPeriod(request);
            result.put("comparison", compare(castMap(result.get("summary")), summary(previous, user)));
        } else result.put("comparison", Map.of());
        result.put("query", request);
        return result;
    }

    public Map<String, Object> details(AnalysisRequest raw, AuthUser user) {
        AnalysisRequest request = normalize(raw);
        if ("behavior".equals(request.mode())) return behaviorDetails(request, user);
        if (request.primaryDimension().startsWith("custom:") || request.secondaryDimension().startsWith("custom:")) return customDetails(request, user);
        SqlFilter filter = filter(request, user);
        StringBuilder where = new StringBuilder(filter.where());
        List<Object> args = new ArrayList<>(filter.args());
        if (notBlank(request.drillLabel()) && "funnel".equals(request.mode())) {
            String label = request.drillLabel();
            if ("已提交".equals(label)) where.append(" AND v.submitted_at IS NOT NULL");
            else if ("已发布".equals(label)) where.append(" AND v.published_at IS NOT NULL");
            else if (label.matches("[1-3]级通过")) {
                where.append(" AND EXISTS (SELECT 1 FROM qa_review_record drill_rr WHERE drill_rr.version_id=v.id AND drill_rr.level_no=? AND drill_rr.result='pass')");
                args.add(Integer.parseInt(label.substring(0, 1)));
            }
        } else if (notBlank(request.drillLabel()) && Set.of("efficiency", "reviewerRanking").contains(request.mode())) {
            where.append(" AND EXISTS (SELECT 1 FROM qa_review_task drill_rt JOIN sys_user drill_ru ON drill_ru.id=drill_rt.reviewer_id WHERE drill_rt.version_id=v.id AND drill_ru.real_name=?)");
            args.add(request.drillLabel());
        } else if (notBlank(request.drillLabel()) && "overdue".equals(request.mode())) {
            where.append(" AND d1.domain_name=? AND EXISTS (SELECT 1 FROM qa_review_task drill_ot WHERE drill_ot.version_id=v.id AND drill_ot.task_status='pending' AND drill_ot.assigned_at<?)");
            args.add(request.drillLabel());
            args.add(Timestamp.from(Instant.now().minus(Duration.ofHours(request.slaHours()))));
        } else if (notBlank(request.drillLabel()) && "trend".equals(request.mode())) {
            String time = TIME_FIELDS.getOrDefault(request.dateRange() == null ? "createdAt" : request.dateRange().timeField(), "p.created_at");
            String pattern = switch (request.granularity()) { case "month" -> "YYYY-MM"; case "week" -> "IYYY-IW"; default -> "YYYY-MM-DD"; };
            where.append(" AND TO_CHAR(").append(time).append(",'").append(pattern).append("') = ?");
            args.add(request.drillLabel());
        } else if (notBlank(request.drillLabel()) && DIMENSIONS.containsKey(request.primaryDimension())) {
            where.append(" AND ").append(DIMENSIONS.get(request.primaryDimension())).append(" = ?");
            args.add(request.drillLabel());
        }
        if (notBlank(request.drillSecondary()) && DIMENSIONS.containsKey(request.secondaryDimension())) {
            where.append(" AND ").append(DIMENSIONS.get(request.secondaryDimension())).append(" = ?");
            args.add(request.drillSecondary());
        }
        String from = pairFrom();
        Integer total = jdbc.queryForObject("SELECT COUNT(*) " + from + where, Integer.class, args.toArray());
        String sort = Map.of("code", "p.qa_code", "createdAt", "p.created_at", "updatedAt", "p.updated_at", "status", "p.status", "author", "u.real_name")
                .getOrDefault(request.sortBy(), "p.updated_at");
        String direction = "asc".equalsIgnoreCase(request.sortDir()) ? "ASC" : "DESC";
        int page = Math.max(1, request.page());
        int pageSize = Math.max(1, Math.min(100, request.pageSize()));
        args.add(pageSize); args.add((page - 1) * pageSize);
        List<Map<String, Object>> items = jdbc.queryForList("SELECT p.id,p.qa_code,p.status,p.created_at,p.updated_at,v.submitted_at,v.published_at,v.version_no,v.question_text,u.real_name author_name,d1.domain_name domain_l1_name,d2.domain_name domain_l2_name,d3.domain_name domain_l3_name " + from + where + " ORDER BY " + sort + " " + direction + " LIMIT ? OFFSET ?", args.toArray());
        return Map.of("items", items, "total", total == null ? 0 : total, "page", page, "pageSize", pageSize);
    }

    private Map<String, Object> customDetails(AnalysisRequest request, AuthUser user) {
        SqlFilter filter = filter(request, user);
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT p.id,p.qa_code,p.status,p.created_at,p.updated_at,v.submitted_at,v.published_at,v.version_no,v.question_text,v.extension_data,u.real_name author_name,u.real_name author,d1.domain_name domain_l1_name,d1.domain_name domain_l1,d2.domain_name domain_l2_name,d2.domain_name domain_l2,d3.domain_name domain_l3_name,d3.domain_name domain_l3 " + pairFrom() + filter.where(), filter.args().toArray());
        Function<Map<String, Object>, String> primary = dimensionReader(request.primaryDimension());
        Function<Map<String, Object>, String> secondary = dimensionReader(request.secondaryDimension());
        List<Map<String, Object>> filtered = rows.stream()
                .filter(row -> !notBlank(request.drillLabel()) || Objects.equals(primary.apply(row), request.drillLabel()))
                .filter(row -> !notBlank(request.drillSecondary()) || Objects.equals(secondary.apply(row), request.drillSecondary()))
                .sorted(customDetailComparator(request))
                .toList();
        int page = Math.max(1, request.page());
        int pageSize = Math.max(1, Math.min(100, request.pageSize()));
        int from = Math.min(filtered.size(), (page - 1) * pageSize);
        int to = Math.min(filtered.size(), from + pageSize);
        List<Map<String, Object>> items = filtered.subList(from, to).stream().map(row -> {
            Map<String, Object> item = new LinkedHashMap<>(row);
            item.remove("extension_data"); item.remove("EXTENSION_DATA");
            return item;
        }).toList();
        return Map.of("items", items, "total", filtered.size(), "page", page, "pageSize", pageSize);
    }

    private Comparator<Map<String, Object>> customDetailComparator(AnalysisRequest request) {
        String key = Map.of("code", "qa_code", "createdAt", "created_at", "updatedAt", "updated_at", "status", "status", "author", "author_name").getOrDefault(request.sortBy(), "updated_at");
        Comparator<Map<String, Object>> comparator = Comparator.comparing(row -> String.valueOf(Optional.ofNullable(value(row, key)).orElse("")), Comparator.nullsLast(String::compareTo));
        return "asc".equalsIgnoreCase(request.sortDir()) ? comparator : comparator.reversed();
    }

    private Map<String, Object> behaviorDetails(AnalysisRequest request, AuthUser user) {
        boolean feedback = "feedback".equalsIgnoreCase(request.drillLabel());
        boolean admin = user.roles().stream().anyMatch(role -> Set.of("SYS_ADMIN", "QA_ADMIN").contains(role));
        String alias = feedback ? "f" : "e";
        String time = feedback ? "f.created_at" : "e.occurred_at";
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (!admin) { where.append(" AND ").append(alias).append(".user_id=?"); args.add(user.id()); }
        if (!feedback && notBlank(request.drillLabel())) { where.append(" AND e.event_type=?"); args.add(request.drillLabel().toUpperCase(Locale.ROOT)); }
        DateRange range = request.dateRange();
        if (range != null && validDate(range.from())) { where.append(" AND ").append(time).append(">=TO_TIMESTAMP(?,'YYYY-MM-DD HH24:MI:SS')"); args.add(range.from()+" 00:00:00"); }
        if (range != null && validDate(range.to())) { where.append(" AND ").append(time).append("<=TO_TIMESTAMP(?,'YYYY-MM-DD HH24:MI:SS')"); args.add(range.to()+" 23:59:59"); }
        String from = feedback
                ? " FROM qa_feedback f LEFT JOIN qa_pair p ON p.id=f.qa_pair_id LEFT JOIN sys_user u ON u.id=f.user_id LEFT JOIN qa_domain d1 ON d1.id=p.domain_l1_id LEFT JOIN qa_domain d2 ON d2.id=p.domain_l2_id"
                : " FROM qa_knowledge_event e LEFT JOIN qa_pair p ON p.id=e.qa_pair_id LEFT JOIN sys_user u ON u.id=e.user_id LEFT JOIN qa_domain d1 ON d1.id=p.domain_l1_id LEFT JOIN qa_domain d2 ON d2.id=p.domain_l2_id";
        Integer total = jdbc.queryForObject("SELECT COUNT(*)" + from + where, Integer.class, args.toArray());
        int page = Math.max(1, request.page());
        int pageSize = Math.max(1, Math.min(100, request.pageSize()));
        args.add(pageSize); args.add((page - 1) * pageSize);
        String select = feedback
                ? "SELECT f.id,COALESCE(p.qa_code,'-') qa_code,'feedback' status,COALESCE(f.comment_text,CONCAT('评分：',CAST(f.rating AS VARCHAR(8)))) question_text,u.real_name author_name,d1.domain_name domain_l1_name,d2.domain_name domain_l2_name,f.created_at updated_at"
                : "SELECT e.id,COALESCE(p.qa_code,'-') qa_code,e.event_type status,COALESCE(e.keyword,'') question_text,u.real_name author_name,d1.domain_name domain_l1_name,d2.domain_name domain_l2_name,e.occurred_at updated_at";
        List<Map<String, Object>> items = jdbc.queryForList(select + from + where + " ORDER BY " + time + " DESC LIMIT ? OFFSET ?", args.toArray());
        return Map.of("items", items, "total", total == null ? 0 : total, "page", page, "pageSize", pageSize);
    }

    public List<Map<String, Object>> allDetails(AnalysisRequest request, AuthUser user) {
        AnalysisRequest normalized = normalize(request);
        List<Map<String, Object>> result = new ArrayList<>();
        int page = 1;
        int total;
        do {
            Map<String, Object> batch = details(new AnalysisRequest(normalized.mode(), normalized.primaryDimension(), normalized.secondaryDimension(), normalized.metrics(), normalized.dateRange(), normalized.filters(), normalized.granularity(), normalized.sortBy(), normalized.sortDir(), normalized.limit(), normalized.comparePreviousPeriod(), normalized.slaHours(), page, 100, normalized.drillLabel(), normalized.drillSecondary()), user);
            result.addAll(castList(batch.get("items")));
            total = ((Number) batch.getOrDefault("total", 0)).intValue();
            page++;
        } while (result.size() < total);
        return result;
    }

    private Map<String, Object> summary(AnalysisRequest request, AuthUser user) {
        SqlFilter filter = filter(request, user);
        String from = pairFrom();
        Map<String, Object> row = jdbc.queryForMap("SELECT COUNT(*) total," +
                " SUM(CASE WHEN p.status='published' THEN 1 ELSE 0 END) published," +
                " SUM(CASE WHEN p.status LIKE 'pending_review_%' THEN 1 ELSE 0 END) pending," +
                " SUM(CASE WHEN p.status LIKE 'rejected_%' THEN 1 ELSE 0 END) rejected," +
                " SUM(CASE WHEN p.status='draft' THEN 1 ELSE 0 END) draft," +
                " SUM(CASE WHEN p.status='retired' THEN 1 ELSE 0 END) retired " + from + filter.where(), filter.args().toArray());
        int total = number(row, "total");
        int published = number(row, "published");
        int rejected = number(row, "rejected");
        List<Map<String, Object>> times = jdbc.queryForList("SELECT v.submitted_at,v.published_at " + from + filter.where() + " AND v.submitted_at IS NOT NULL AND v.published_at IS NOT NULL", filter.args().toArray());
        double avgHours = times.stream().mapToDouble(item -> durationHours(value(item, "submitted_at"), value(item, "published_at"))).average().orElse(0);
        List<Object> reviewArgs = new ArrayList<>(filter.args());
        Map<String, Object> decisions = jdbc.queryForMap("SELECT COUNT(*) decisions,SUM(CASE WHEN rr.result='pass' THEN 1 ELSE 0 END) passed,SUM(CASE WHEN rr.result='reject' THEN 1 ELSE 0 END) rejected_decisions FROM qa_review_record rr JOIN qa_pair_version rv ON rv.id=rr.version_id JOIN qa_pair p ON p.id=rv.qa_pair_id JOIN qa_pair_version v ON v.id=p.current_version_id JOIN sys_user u ON u.id=p.author_id JOIN qa_domain d1 ON d1.id=p.domain_l1_id JOIN qa_domain d2 ON d2.id=p.domain_l2_id LEFT JOIN qa_domain d3 ON d3.id=p.domain_l3_id " + filter.where(), reviewArgs.toArray());
        int decisionCount = number(decisions, "decisions");
        int passed = number(decisions, "passed");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", total); result.put("published", published); result.put("pending", number(row, "pending"));
        result.put("rejected", rejected); result.put("draft", number(row, "draft")); result.put("retired", number(row, "retired"));
        result.put("publishRate", percent(published, total)); result.put("passRate", percent(passed, decisionCount));
        result.put("rejectRate", percent(number(decisions, "rejected_decisions"), decisionCount));
        result.put("avgReviewHours", round(avgHours));
        return result;
    }

    private List<Map<String, Object>> trend(AnalysisRequest request, AuthUser user) {
        SqlFilter f = filter(request, user);
        String time = TIME_FIELDS.getOrDefault(request.dateRange() == null ? "createdAt" : request.dateRange().timeField(), "p.created_at");
        String pattern = switch (request.granularity()) { case "month" -> "YYYY-MM"; case "week" -> "IYYY-IW"; default -> "YYYY-MM-DD"; };
        return jdbc.queryForList("SELECT TO_CHAR(" + time + ",'" + pattern + "') label,COUNT(*) count,SUM(CASE WHEN p.status='published' THEN 1 ELSE 0 END) published,SUM(CASE WHEN p.status LIKE 'rejected_%' THEN 1 ELSE 0 END) rejected " + pairFrom() + f.where() + " AND " + time + " IS NOT NULL GROUP BY TO_CHAR(" + time + ",'" + pattern + "') ORDER BY label", f.args().toArray());
    }

    private List<Map<String, Object>> distribution(AnalysisRequest request, AuthUser user) {
        if (request.primaryDimension().startsWith("custom:")) return customDistribution(request, user);
        String dimension = DIMENSIONS.getOrDefault(request.primaryDimension(), "p.status");
        SqlFilter f = filter(request, user);
        List<Object> args = new ArrayList<>(f.args()); args.add(request.limit());
        return jdbc.queryForList("SELECT " + dimension + " label,COUNT(*) count,SUM(CASE WHEN p.status='published' THEN 1 ELSE 0 END) published,SUM(CASE WHEN p.status LIKE 'pending_review_%' THEN 1 ELSE 0 END) pending,SUM(CASE WHEN p.status LIKE 'rejected_%' THEN 1 ELSE 0 END) rejected " + pairFrom() + f.where() + " GROUP BY " + dimension + " ORDER BY count DESC LIMIT ?", args.toArray());
    }

    private List<Map<String, Object>> cross(AnalysisRequest request, AuthUser user) {
        if (request.primaryDimension().startsWith("custom:") || request.secondaryDimension().startsWith("custom:")) return customCross(request, user);
        String first = DIMENSIONS.getOrDefault(request.primaryDimension(), "d1.domain_name");
        String second = DIMENSIONS.getOrDefault(request.secondaryDimension(), "p.status");
        SqlFilter f = filter(request, user);
        List<Object> args = new ArrayList<>(f.args()); args.add(Math.min(200, request.limit() * request.limit()));
        return jdbc.queryForList("SELECT " + first + " label," + second + " secondary_label,COUNT(*) count " + pairFrom() + f.where() + " GROUP BY " + first + "," + second + " ORDER BY count DESC LIMIT ?", args.toArray());
    }

    private List<Map<String, Object>> efficiency(AnalysisRequest request, AuthUser user) {
        SqlFilter f = filter(request, user);
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT ru.real_name label,t.task_status,t.assigned_at,t.completed_at,t.level_no " + pairFrom() + " JOIN qa_review_task t ON t.version_id=v.id JOIN sys_user ru ON ru.id=t.reviewer_id " + f.where(), f.args().toArray());
        Map<String, Efficiency> grouped = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String label = string(row, "label", "未知");
            Efficiency item = grouped.computeIfAbsent(label, ignored -> new Efficiency());
            String status = string(row, "task_status", "");
            if (Set.of("pass", "reject").contains(status)) item.processed++;
            if ("pass".equals(status)) item.passed++;
            if ("reject".equals(status)) item.rejected++;
            if (value(row, "completed_at") != null) { item.hours += durationHours(value(row, "assigned_at"), value(row, "completed_at")); item.timed++; }
            if ("pending".equals(status)) item.pending++;
        }
        return grouped.entrySet().stream().map(e -> {
            Map<String, Object> row = new LinkedHashMap<>(); row.put("label", e.getKey()); row.put("count", e.getValue().processed);
            row.put("passed", e.getValue().passed); row.put("rejected", e.getValue().rejected); row.put("pending", e.getValue().pending);
            row.put("passRate", percent(e.getValue().passed, e.getValue().processed)); row.put("avgHours", round(e.getValue().timed == 0 ? 0 : e.getValue().hours / e.getValue().timed)); return row;
        }).sorted(Comparator.comparingInt(row -> -((Number) row.get("count")).intValue())).limit(request.limit()).toList();
    }

    private List<Map<String, Object>> funnel(AnalysisRequest request, AuthUser user) {
        SqlFilter f = filter(request, user);
        String from = pairFrom();
        int submitted = scalar("SELECT COUNT(*) " + from + f.where() + " AND v.submitted_at IS NOT NULL", f.args());
        List<Map<String, Object>> result = new ArrayList<>();
        result.add(stage("已提交", submitted, submitted));
        for (int level = 1; level <= 3; level++) {
            List<Object> args = new ArrayList<>(f.args()); args.add(level);
            int count = scalar("SELECT COUNT(DISTINCT p.id) " + from + f.where() + " AND EXISTS (SELECT 1 FROM qa_review_record rr WHERE rr.version_id=v.id AND rr.level_no=? AND rr.result='pass')", args);
            result.add(stage(level + "级通过", count, submitted));
        }
        int published = scalar("SELECT COUNT(*) " + from + f.where() + " AND v.published_at IS NOT NULL", f.args());
        result.add(stage("已发布", published, submitted));
        return result;
    }

    private List<Map<String, Object>> overdue(AnalysisRequest request, AuthUser user) {
        SqlFilter f = filter(request, user);
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT t.level_no,t.assigned_at,ru.real_name reviewer_name,d1.domain_name domain_name " + pairFrom() + " JOIN qa_review_task t ON t.version_id=v.id JOIN sys_user ru ON ru.id=t.reviewer_id " + f.where() + " AND t.task_status='pending'", f.args().toArray());
        long sla = Math.max(1, request.slaHours());
        Map<String, Long> grouped = rows.stream().filter(row -> durationHours(value(row, "assigned_at"), Timestamp.from(Instant.now())) > sla)
                .collect(Collectors.groupingBy(row -> string(row, "domain_name", "未知目录"), LinkedHashMap::new, Collectors.counting()));
        return grouped.entrySet().stream().map(e -> Map.<String, Object>of("label", e.getKey(), "count", e.getValue(), "slaHours", sla))
                .sorted(Comparator.comparingLong(row -> -((Number) row.get("count")).longValue())).toList();
    }

    private List<Map<String, Object>> behavior(AnalysisRequest request, AuthUser user) {
        DateRange range = request.dateRange();
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        boolean admin = user.roles().stream().anyMatch(role -> Set.of("SYS_ADMIN", "QA_ADMIN").contains(role));
        if (!admin) { where.append(" AND e.user_id=?"); args.add(user.id()); }
        if (range != null && validDate(range.from())) { where.append(" AND e.occurred_at>=TO_TIMESTAMP(?,'YYYY-MM-DD HH24:MI:SS')"); args.add(range.from() + " 00:00:00"); }
        if (range != null && validDate(range.to())) { where.append(" AND e.occurred_at<=TO_TIMESTAMP(?,'YYYY-MM-DD HH24:MI:SS')"); args.add(range.to() + " 23:59:59"); }
        String eventSql = "SELECT e.event_type label,COUNT(*) count FROM qa_knowledge_event e" + where + " GROUP BY e.event_type ORDER BY count DESC";
        List<Map<String, Object>> events = new ArrayList<>(jdbc.queryForList(eventSql, args.toArray()));
        Map<String, Object> feedback = admin
                ? jdbc.queryForMap("SELECT COUNT(*) feedback_count,AVG(rating) avg_rating,SUM(CASE WHEN helpful=1 THEN 1 ELSE 0 END) helpful_count FROM qa_feedback")
                : jdbc.queryForMap("SELECT COUNT(*) feedback_count,AVG(rating) avg_rating,SUM(CASE WHEN helpful=1 THEN 1 ELSE 0 END) helpful_count FROM qa_feedback WHERE user_id=?", user.id());
        events.add(Map.of("label", "feedback", "count", number(feedback, "feedback_count"), "avgRating", decimal(feedback, "avg_rating"), "helpful", number(feedback, "helpful_count")));
        return events;
    }

    private List<Map<String, Object>> customDistribution(AnalysisRequest request, AuthUser user) {
        String code = request.primaryDimension().substring("custom:".length());
        Map<String, Long> grouped = customRows(request, user).stream().collect(Collectors.groupingBy(row -> customValue(row, code), LinkedHashMap::new, Collectors.counting()));
        return grouped.entrySet().stream().map(e -> Map.<String, Object>of("label", e.getKey(), "count", e.getValue())).sorted(Comparator.comparingLong(row -> -((Number) row.get("count")).longValue())).limit(request.limit()).toList();
    }

    private List<Map<String, Object>> customCross(AnalysisRequest request, AuthUser user) {
        List<Map<String, Object>> source = customRows(request, user);
        Function<Map<String, Object>, String> first = dimensionReader(request.primaryDimension());
        Function<Map<String, Object>, String> second = dimensionReader(request.secondaryDimension());
        Map<String, Long> grouped = source.stream().collect(Collectors.groupingBy(row -> first.apply(row) + "\u0000" + second.apply(row), LinkedHashMap::new, Collectors.counting()));
        return grouped.entrySet().stream().map(e -> { String[] keys=e.getKey().split("\u0000",-1); return Map.<String,Object>of("label",keys[0],"secondary_label",keys[1],"count",e.getValue()); }).limit(200).toList();
    }

    private List<Map<String, Object>> customRows(AnalysisRequest request, AuthUser user) {
        SqlFilter f = filter(request, user);
        return jdbc.queryForList("SELECT p.status,d1.domain_name domain_l1,d2.domain_name domain_l2,d3.domain_name domain_l3,u.real_name author,v.extension_data " + pairFrom() + f.where(), f.args().toArray());
    }

    private Function<Map<String, Object>, String> dimensionReader(String dimension) {
        if (dimension.startsWith("custom:")) { String code=dimension.substring(7); return row -> customValue(row,code); }
        String key=Map.of("status","status","domainL1","domain_l1","domainL2","domain_l2","domainL3","domain_l3","author","author").getOrDefault(dimension,"status");
        return row -> string(row,key,"未配置");
    }

    private String customValue(Map<String, Object> row, String code) {
        Object raw = value(row, "extension_data");
        if (raw == null) return "未配置";
        try { Map<String,Object> values=mapper.readValue(String.valueOf(raw),new TypeReference<>(){}); Object value=values.get(code); return value==null||String.valueOf(value).isBlank()?"未配置":String.valueOf(value); }
        catch (Exception ignored) { return "未配置"; }
    }

    private SqlFilter filter(AnalysisRequest request, AuthUser user) {
        StringBuilder where = new StringBuilder(" WHERE p.deleted=0");
        List<Object> args = new ArrayList<>();
        boolean admin = user.roles().stream().anyMatch(role -> Set.of("SYS_ADMIN", "QA_ADMIN").contains(role));
        if (!admin) { where.append(" AND (p.author_id=? OR EXISTS (SELECT 1 FROM qa_review_task perm WHERE perm.version_id=v.id AND perm.reviewer_id=?))"); args.add(user.id()); args.add(user.id()); }
        DateRange range = request.dateRange();
        String time = TIME_FIELDS.getOrDefault(range == null ? "createdAt" : range.timeField(), "p.created_at");
        if (range != null && validDate(range.from())) { where.append(" AND ").append(time).append(">=TO_TIMESTAMP(?,'YYYY-MM-DD HH24:MI:SS')"); args.add(range.from()+" 00:00:00"); }
        if (range != null && validDate(range.to())) { where.append(" AND ").append(time).append("<=TO_TIMESTAMP(?,'YYYY-MM-DD HH24:MI:SS')"); args.add(range.to()+" 23:59:59"); }
        Filters filters = request.filters();
        appendIn(where,args,"p.status",filters.statuses()); appendIn(where,args,"p.domain_l1_id",filters.domainL1Ids());
        appendIn(where,args,"p.domain_l2_id",filters.domainL2Ids()); appendIn(where,args,"p.domain_l3_id",filters.domainL3Ids()); appendIn(where,args,"p.author_id",filters.authorIds());
        if (filters.reviewerIds()!=null&&!filters.reviewerIds().isEmpty()) { where.append(" AND EXISTS (SELECT 1 FROM qa_review_task rf WHERE rf.version_id=v.id AND rf.reviewer_id IN (").append(placeholders(filters.reviewerIds().size())).append("))"); args.addAll(filters.reviewerIds()); }
        if (notBlank(filters.keyword())) { where.append(" AND (p.qa_code LIKE ? OR v.question_text LIKE ? OR v.answer_text LIKE ?)"); String keyword="%"+filters.keyword().trim()+"%"; args.add(keyword);args.add(keyword);args.add(keyword); }
        if (filters.hasAttachment()!=null) where.append(filters.hasAttachment()?" AND EXISTS (SELECT 1 FROM qa_attachment a WHERE a.version_id=v.id)":" AND NOT EXISTS (SELECT 1 FROM qa_attachment a WHERE a.version_id=v.id)");
        if (filters.hasReference()!=null) where.append(filters.hasReference()?" AND v.reference_doc IS NOT NULL":" AND v.reference_doc IS NULL");
        return new SqlFilter(where.toString(),args);
    }

    private String pairFrom() { return "FROM qa_pair p JOIN qa_pair_version v ON v.id=p.current_version_id JOIN sys_user u ON u.id=p.author_id JOIN qa_domain d1 ON d1.id=p.domain_l1_id JOIN qa_domain d2 ON d2.id=p.domain_l2_id LEFT JOIN qa_domain d3 ON d3.id=p.domain_l3_id "; }

    private AnalysisRequest normalize(AnalysisRequest r) {
        if (r == null) r = new AnalysisRequest(null,null,null,null,null,null,null,null,null,0,false,0,1,10,null,null);
        String mode=r.mode()!=null&&MODES.contains(r.mode())?r.mode():"trend";
        String primary=validDimension(r.primaryDimension())?r.primaryDimension():"status";
        String secondary=validDimension(r.secondaryDimension())?r.secondaryDimension():"status";
        DateRange rawRange=r.dateRange();
        DateRange range=rawRange==null
                ?new DateRange(LocalDate.now().minusDays(29).toString(),LocalDate.now().toString(),"createdAt")
                :new DateRange(rawRange.from(),rawRange.to(),rawRange.timeField()!=null&&TIME_FIELDS.containsKey(rawRange.timeField())?rawRange.timeField():"createdAt");
        Filters filters=r.filters()==null?new Filters(List.of(),List.of(),List.of(),List.of(),List.of(),List.of(),null,null,null):r.filters();
        String granularity=r.granularity()!=null&&Set.of("day","week","month").contains(r.granularity())?r.granularity():"day";
        return new AnalysisRequest(mode,primary,secondary,r.metrics()==null?List.of("count"):r.metrics(),range,filters,granularity,r.sortBy()==null?"updatedAt":r.sortBy(),r.sortDir()==null?"desc":r.sortDir(),Math.max(5,Math.min(50,r.limit()<=0?20:r.limit())),r.comparePreviousPeriod(),Math.max(1,r.slaHours()<=0?24:r.slaHours()),Math.max(1,r.page()),Math.max(1,r.pageSize()<=0?10:r.pageSize()),r.drillLabel(),r.drillSecondary());
    }

    private AnalysisRequest previousPeriod(AnalysisRequest r) {
        LocalDate from=LocalDate.parse(r.dateRange().from()),to=LocalDate.parse(r.dateRange().to()); long days=Duration.between(from.atStartOfDay(),to.plusDays(1).atStartOfDay()).toDays(); LocalDate previousTo=from.minusDays(1),previousFrom=previousTo.minusDays(days-1);
        return new AnalysisRequest(r.mode(),r.primaryDimension(),r.secondaryDimension(),r.metrics(),new DateRange(previousFrom.toString(),previousTo.toString(),r.dateRange().timeField()),r.filters(),r.granularity(),r.sortBy(),r.sortDir(),r.limit(),false,r.slaHours(),r.page(),r.pageSize(),r.drillLabel(),r.drillSecondary());
    }

    private Map<String,Object> compare(Map<String,Object> current,Map<String,Object> previous){Map<String,Object> result=new LinkedHashMap<>();for(String key:List.of("total","published","pending","rejected","publishRate","passRate","rejectRate","avgReviewHours")){double now=toDouble(current.get(key)),before=toDouble(previous.get(key));result.put(key,Map.of("current",now,"previous",before,"change",round(now-before),"changeRate",before==0?(now==0?0:100):round((now-before)*100/before)));}return result;}
    private Map<String,Object> stage(String label,int count,int base){return Map.of("label",label,"count",count,"rate",percent(count,base));}
    private void appendIn(StringBuilder sql,List<Object> args,String column,List<String> values){if(values!=null&&!values.isEmpty()){sql.append(" AND ").append(column).append(" IN (").append(placeholders(values.size())).append(")");args.addAll(values);}}
    private String placeholders(int size){return String.join(",",Collections.nCopies(size,"?"));}
    private int scalar(String sql,List<Object> args){Integer value=jdbc.queryForObject(sql,Integer.class,args.toArray());return value==null?0:value;}
    private boolean validDimension(String value){return value!=null&&(DIMENSIONS.containsKey(value)||value.startsWith("custom:"));}
    private boolean validDate(String value){try{LocalDate.parse(value);return true;}catch(Exception ignored){return false;}}
    private boolean notBlank(String value){return value!=null&&!value.isBlank();}
    private Object value(Map<String,Object> row,String key){return row.containsKey(key)?row.get(key):row.get(key.toUpperCase(Locale.ROOT));}
    private String string(Map<String,Object> row,String key,String fallback){Object value=value(row,key);return value==null||String.valueOf(value).isBlank()?fallback:String.valueOf(value);}
    private int number(Map<String,Object> row,String key){Object value=value(row,key);return value instanceof Number n?n.intValue():0;}
    private double decimal(Map<String,Object> row,String key){Object value=value(row,key);return value instanceof Number n?round(n.doubleValue()):0;}
    private double durationHours(Object from,Object to){if(!(from instanceof java.util.Date a)||!(to instanceof java.util.Date b))return 0;return Math.max(0,(b.getTime()-a.getTime())/3600000d);}
    private double percent(double part,double total){return total<=0?0:round(part*100/total);}
    private double round(double value){return Math.round(value*100d)/100d;}
    private double toDouble(Object value){return value instanceof Number n?n.doubleValue():0;}
    @SuppressWarnings("unchecked") private Map<String,Object> castMap(Object value){return (Map<String,Object>)value;}
    @SuppressWarnings("unchecked") private List<Map<String,Object>> castList(Object value){return (List<Map<String,Object>>)value;}

    private record SqlFilter(String where,List<Object> args){}
    private static final class Efficiency {int processed,passed,rejected,pending,timed;double hours;}

    /**
     * Request DTOs intentionally use ordinary static classes instead of nested records.
     * Some JDK/Jackson combinations cannot reflect record components when the enclosing
     * service is proxied by Spring, which made /api/analysis/query fail before entering
     * the controller. Public fields keep the wire format stable and make deserialization
     * independent of constructor parameter-name metadata.
     */
    public static final class DateRange {
        public String from;
        public String to;
        public String timeField;
        public DateRange() {}
        public DateRange(String from,String to,String timeField){this.from=from;this.to=to;this.timeField=timeField;}
        public String from(){return from;} public String to(){return to;} public String timeField(){return timeField;}
    }

    public static final class Filters {
        public List<String> statuses;
        public List<String> domainL1Ids;
        public List<String> domainL2Ids;
        public List<String> domainL3Ids;
        public List<String> authorIds;
        public List<String> reviewerIds;
        public String keyword;
        public Boolean hasAttachment;
        public Boolean hasReference;
        public Filters() {}
        public Filters(List<String> statuses,List<String> domainL1Ids,List<String> domainL2Ids,List<String> domainL3Ids,List<String> authorIds,List<String> reviewerIds,String keyword,Boolean hasAttachment,Boolean hasReference){
            this.statuses=statuses;this.domainL1Ids=domainL1Ids;this.domainL2Ids=domainL2Ids;this.domainL3Ids=domainL3Ids;this.authorIds=authorIds;this.reviewerIds=reviewerIds;this.keyword=keyword;this.hasAttachment=hasAttachment;this.hasReference=hasReference;
        }
        public List<String> statuses(){return statuses;} public List<String> domainL1Ids(){return domainL1Ids;} public List<String> domainL2Ids(){return domainL2Ids;} public List<String> domainL3Ids(){return domainL3Ids;}
        public List<String> authorIds(){return authorIds;} public List<String> reviewerIds(){return reviewerIds;} public String keyword(){return keyword;} public Boolean hasAttachment(){return hasAttachment;} public Boolean hasReference(){return hasReference;}
    }

    public static final class AnalysisRequest {
        public String mode;
        public String primaryDimension;
        public String secondaryDimension;
        public List<String> metrics;
        public DateRange dateRange;
        public Filters filters;
        public String granularity;
        public String sortBy;
        public String sortDir;
        public int limit;
        public boolean comparePreviousPeriod;
        public int slaHours;
        public int page;
        public int pageSize;
        public String drillLabel;
        public String drillSecondary;
        public AnalysisRequest() {}
        public AnalysisRequest(String mode,String primaryDimension,String secondaryDimension,List<String> metrics,DateRange dateRange,Filters filters,String granularity,String sortBy,String sortDir,int limit,boolean comparePreviousPeriod,int slaHours,int page,int pageSize,String drillLabel,String drillSecondary){
            this.mode=mode;this.primaryDimension=primaryDimension;this.secondaryDimension=secondaryDimension;this.metrics=metrics;this.dateRange=dateRange;this.filters=filters;this.granularity=granularity;this.sortBy=sortBy;this.sortDir=sortDir;this.limit=limit;this.comparePreviousPeriod=comparePreviousPeriod;this.slaHours=slaHours;this.page=page;this.pageSize=pageSize;this.drillLabel=drillLabel;this.drillSecondary=drillSecondary;
        }
        public String mode(){return mode;} public String primaryDimension(){return primaryDimension;} public String secondaryDimension(){return secondaryDimension;} public List<String> metrics(){return metrics;} public DateRange dateRange(){return dateRange;} public Filters filters(){return filters;}
        public String granularity(){return granularity;} public String sortBy(){return sortBy;} public String sortDir(){return sortDir;} public int limit(){return limit;} public boolean comparePreviousPeriod(){return comparePreviousPeriod;} public int slaHours(){return slaHours;} public int page(){return page;} public int pageSize(){return pageSize;} public String drillLabel(){return drillLabel;} public String drillSecondary(){return drillSecondary;}
    }
}
