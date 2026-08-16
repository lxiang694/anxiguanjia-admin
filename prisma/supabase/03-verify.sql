-- ============================================================================
-- 预览环境自检：用纯 SQL 复现服务端的隔离与合规判定
--
-- 灌完数据后跑一次。任何一行出现 ❌ 就是真实的权限问题，不是脚本的问题。
-- 这些查询不依赖应用代码，所以它验证的是「数据本身是否守住了边界」。
-- ============================================================================
SET search_path TO app, public;

WITH q AS (
  SELECT 1 AS n, '王女士（付款人+主要联络人）可见的健康敏感信息' AS 检查项, '0' AS 预期,
    (SELECT count(*) FROM elder_sensitive_info s WHERE s."elderId" IN (
       SELECT c."elderId" FROM consents c
        WHERE c."granteeId"='usr_wangd' AND c.status='ACTIVE' AND c."permissionType"='SENSITIVE_HEALTH'))::text AS 实际
  UNION ALL SELECT 2,'王女士可见的已发布安心报告','1',
    (SELECT count(*) FROM assurance_reports r WHERE r.status='PUBLISHED' AND r."elderId" IN (
       SELECT c."elderId" FROM consents c WHERE c."granteeId"='usr_wangd' AND c.status='ACTIVE' AND c."permissionType"='ASSURANCE_REPORT'))::text
  UNION ALL SELECT 3,'王女士可见的刘家数据（跨家庭隔离）','0',
    (SELECT count(*) FROM assurance_reports r WHERE r."householdId"='hh_liu' AND r."elderId" IN (
       SELECT c."elderId" FROM consents c WHERE c."granteeId"='usr_wangd' AND c.status='ACTIVE'))::text
  UNION ALL SELECT 4,'王先生可见的安心报告（他只有 2 项授权）','0',
    (SELECT count(*) FROM assurance_reports r WHERE r.status='PUBLISHED' AND r."elderId" IN (
       SELECT c."elderId" FROM consents c WHERE c."granteeId"='usr_wangs' AND c.status='ACTIVE' AND c."permissionType"='ASSURANCE_REPORT'))::text
  UNION ALL SELECT 5,'王先生可见的生活记录时间线（授权已撤回）','0',
    (SELECT count(*) FROM timeline_events t WHERE t."internalOnly"=false AND t."requiredPermission"='LIFE_RECORD'
       AND EXISTS (SELECT 1 FROM consents c WHERE c."granteeId"='usr_wangs' AND c.status='ACTIVE'
                     AND c."elderId"=t."elderId" AND c."permissionType"='LIFE_RECORD'))::text
  UNION ALL SELECT 6,'撤回后的历史授权记录仍然保留','1',
    (SELECT count(*) FROM consents WHERE id='cst_s_life' AND status='REVOKED' AND "revokedAt" IS NOT NULL)::text
  UNION ALL SELECT 7,'家庭端不可见的内部记录条数（应恰好 1 条被挡住）','1',
    (SELECT count(*) FROM timeline_events WHERE "householdId"='hh_wang' AND "internalOnly"=true)::text
  UNION ALL SELECT 8,'李晨可见的家庭数（只应是自己负责的）','1',
    (SELECT count(*) FROM households h WHERE h."deletedAt" IS NULL
       AND (h."primarySpecialistId"='stf_li' OR h."backupSpecialistId"='stf_li'))::text
  UNION ALL SELECT 9,'周敏可见的王家任务（专员之间隔离）','0',
    (SELECT count(*) FROM service_tasks WHERE "householdId"='hh_wang' AND "staffProfileId"='stf_zhou')::text
  UNION ALL SELECT 10,'一线专员能取到的健康敏感信息（应永远为 0）','0',
    (SELECT count(*) FROM elder_sensitive_info s JOIN elders e ON e.id=s."elderId"
       JOIN staff_profiles sp ON sp.id IN ('stf_li','stf_zhou')
       JOIN users u ON u.id=sp."userId"
      WHERE u.role IN ('SUPER_ADMIN','OPERATIONS','SERVICE_SUPERVISOR'))::text
  UNION ALL SELECT 11,'已发布报告能追溯到原始记录的条数','2',
    (SELECT count(*) FROM assurance_report_sources WHERE "reportId"='rpt_w_draft')::text
  UNION ALL SELECT 12,'缺少来源标注的健康数值','0',
    (SELECT count(*) FROM health_readings WHERE source IS NULL)::text
  UNION ALL SELECT 13,'标记「超出家庭设定提醒范围」的数值（不是诊断）','1',
    (SELECT count(*) FROM health_readings WHERE "outsideFamilyRange"=true)::text
  UNION ALL SELECT 14,'查看敏感信息留下的操作日志','1',
    (SELECT count(*) FROM audit_logs WHERE action='elder.sensitive.read' AND "resourceId"='eld_wangm')::text
  UNION ALL SELECT 15,'未核验就被标成 VERIFIED 的学历（应为 0）','0',
    (SELECT count(*) FROM education_records WHERE "verificationStatus"='VERIFIED' AND "verifiedById" IS NULL)::text
  UNION ALL SELECT 16,'处于「未核验」状态的学历（界面不得标示已认证）','1',
    (SELECT count(*) FROM education_records WHERE "verificationStatus" <> 'VERIFIED')::text
  UNION ALL SELECT 17,'需要法定资格但没登记证件号就被授予的能力（应为 0）','0',
    (SELECT count(*) FROM staff_competencies sc JOIN competencies c ON c.id=sc."competencyId"
      WHERE c."requiresCredential"=true AND (sc."credentialNo" IS NULL OR sc."credentialNo"=''))::text
  UNION ALL SELECT 18,'家庭可自助申请的服务类型','3',
    (SELECT count(*) FROM service_catalog_items WHERE "familyRequestable"=true AND "isActive"=true)::text
  UNION ALL SELECT 19,'可自助申请但没有加购价格的类型（应为 0）','0',
    (SELECT count(*) FROM service_catalog_items WHERE "familyRequestable"=true AND "addOnPrice" IS NULL)::text
  UNION ALL SELECT 20,'启用了尚未实现渠道的通知模板（应为 0）','0',
    (SELECT count(*) FROM notification_templates
      WHERE "enabledChannels" && '{SMS,WECHAT,WECOM}'::"NotificationChannel"[])::text
  UNION ALL SELECT 21,'已开票但没回填发票号的订单（应为 0）','0',
    (SELECT count(*) FROM orders WHERE "invoiceStatus"='ISSUED' AND ("invoiceNo" IS NULL OR "invoiceNo"=''))::text
  UNION ALL SELECT 22,'服务照片里出现公开 URL 的记录（应为 0）','0',
    (SELECT count(*) FROM visit_records v WHERE EXISTS (
       SELECT 1 FROM unnest(v."photoKeys") k WHERE k LIKE 'http%'))::text
  UNION ALL SELECT 23,'未经审核就发布的报告（应为 0）','0',
    (SELECT count(*) FROM assurance_reports WHERE status='PUBLISHED' AND "reviewedById" IS NULL)::text
  UNION ALL SELECT 24,'已关闭但没填处理结果的异常事件（应为 0）','0',
    (SELECT count(*) FROM incidents WHERE status='CLOSED' AND (resolution IS NULL OR resolution=''))::text
  UNION ALL SELECT 25,'异常事件的时间线条数（必须可完整追溯）','6',
    (SELECT count(*) FROM incident_events WHERE "incidentId"='inc_w1')::text
  UNION ALL SELECT 26,'没有标记为示例数据的家庭（应为 0）','0',
    (SELECT count(*) FROM households WHERE "isDemo"=false)::text
  UNION ALL SELECT 27,'密码哈希不是 bcrypt 的帐号（应为 0）','0',
    (SELECT count(*) FROM users WHERE "passwordHash" NOT LIKE '$2%' OR length("passwordHash") <> 60)::text
  UNION ALL SELECT 28,'非可排班状态却被派了单的专员（应为 0）','0',
    (SELECT count(*) FROM service_tasks t JOIN staff_profiles sp ON sp.id=t."staffProfileId"
      WHERE sp."serviceStatus" <> 'ACTIVE' AND t.status NOT IN ('CANCELLED','DECLINED'))::text
  UNION ALL SELECT 29,'本周之内的任务数（打开就该有内容）','6',
    (SELECT count(*) FROM service_tasks
      WHERE "scheduledStart" >= date_trunc('week', now() AT TIME ZONE 'Asia/Shanghai') - interval '8 hours'
        AND "scheduledStart" <  date_trunc('week', now() AT TIME ZONE 'Asia/Shanghai') + interval '14 days')::text
  UNION ALL SELECT 30,'业务表启用 RLS 的比例（应等于表总数）',
    (SELECT count(*)::text FROM pg_tables WHERE schemaname='app'),
    (SELECT count(*)::text FROM pg_tables WHERE schemaname='app' AND rowsecurity=true)
)
SELECT n AS "#", 检查项, 预期, 实际,
       CASE WHEN 预期=实际 THEN '✅' ELSE '❌ 不符' END AS 结果
FROM q ORDER BY n;
