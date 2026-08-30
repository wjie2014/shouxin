-- 为每个既有二级目录补齐一个语义对应的三级知识目录。
-- 使用二级目录的稳定编号生成幂等主键和全局唯一目录编码。
INSERT INTO qa_domain(id, parent_id, domain_code, domain_name, level_no, path, sort_order)
SELECT REPLACE(d.id, 'domain-l2-', 'domain-l3-'),
       d.id,
       'L3-' || d.domain_code,
       d.domain_name || '知识',
       3,
       d.path || ' / ' || d.domain_name || '知识',
       1
FROM qa_domain d
WHERE d.level_no = 2
  AND d.deleted = 0
  AND d.id LIKE 'domain-l2-%'
  AND NOT EXISTS (
      SELECT 1
      FROM qa_domain child
      WHERE child.parent_id = d.id
        AND child.level_no = 3
        AND child.deleted = 0
  );
