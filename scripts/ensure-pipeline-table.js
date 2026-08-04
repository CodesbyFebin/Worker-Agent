const fs = require("fs");
const mysql = require("mysql2/promise");

const env = fs.readFileSync(".env", "utf8");
const match = env.match(/^DATABASE_URL=(.+)$/m);
if (!match) throw new Error("DATABASE_URL missing");
const url = match[1].trim().replace(/^"|"$/g, "");

(async () => {
  const c = await mysql.createConnection(url);
  const [rows] = await c.query("SHOW TABLES LIKE 'content_ops_pipelines'");
  console.log("tables", rows);
  if (!rows.length) {
    await c.query(`
      CREATE TABLE content_ops_pipelines (
        id varchar(36) NOT NULL PRIMARY KEY,
        user_id varchar(36) NOT NULL,
        script_id varchar(36) NOT NULL,
        root_task_id varchar(36),
        campaign_id varchar(36),
        title varchar(255) NOT NULL,
        pipeline_stage enum('god_machine','script_studio','evidence','research_to_post','workspace','youtube_autopilot','social','approvals','publishing','done') NOT NULL DEFAULT 'god_machine',
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY content_ops_pipelines_user_id_idx (user_id),
        KEY content_ops_pipelines_script_id_idx (script_id),
        KEY content_ops_pipelines_stage_idx (pipeline_stage),
        CONSTRAINT content_ops_pipelines_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT content_ops_pipelines_script_id_scripts_id_fk FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
      )
    `);
    console.log("created");
  } else {
    console.log("exists");
  }
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
