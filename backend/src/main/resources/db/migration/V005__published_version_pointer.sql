ALTER TABLE qa_pair ADD published_version_id VARCHAR(36);
ALTER TABLE qa_pair ADD CONSTRAINT fk_qa_pair_published_version FOREIGN KEY (published_version_id) REFERENCES qa_pair_version(id);
