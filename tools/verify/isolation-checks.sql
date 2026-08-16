SET search_path TO check_model;
\pset format aligned
\pset border 2

-- 每一条都写成「预期值」+「实际值」，不符合就是真实的权限漏洞。
WITH q AS (
  SELECT '1. 王女士（付款人）可见的健康敏感信息条数' AS 检查项, '0' AS 预期,
    (SELECT count(*) FROM elder_sensitive_info s
      WHERE s."elderId" IN (
        SELECT c."elderId" FROM consents c
         WHERE c."granteeId"='u_wd' AND c.status='ACTIVE' AND c."permissionType"='SENSITIVE_HEALTH'))::text AS 实际
  UNION ALL SELECT '2. 王女士可见的安心报告数（本家庭且有 ASSURANCE_REPORT 授权）','1',
    (SELECT count(*) FROM assurance_reports r
      WHERE r.status='PUBLISHED' AND r."elderId" IN (
        SELECT c."elderId" FROM consents c WHERE c."granteeId"='u_wd' AND c.status='ACTIVE' AND c."permissionType"='ASSURANCE_REPORT'))::text
  UNION ALL SELECT '3. 王女士可见的刘家报告数（跨家庭隔离）','0',
    (SELECT count(*) FROM assurance_reports r
      WHERE r."householdId"='h_liu' AND r."elderId" IN (
        SELECT c."elderId" FROM consents c WHERE c."granteeId"='u_wd' AND c.status='ACTIVE' AND c."permissionType"='ASSURANCE_REPORT'))::text
  UNION ALL SELECT '4. 王先生可见的安心报告数（只有服务安排/异常授权）','0',
    (SELECT count(*) FROM assurance_reports r
      WHERE r.status='PUBLISHED' AND r."elderId" IN (
        SELECT c."elderId" FROM consents c WHERE c."granteeId"='u_ws' AND c.status='ACTIVE' AND c."permissionType"='ASSURANCE_REPORT'))::text
  UNION ALL SELECT '5. 王先生可见的生活记录时间线数（授权已撤回）','0',
    (SELECT count(*) FROM timeline_events t
      WHERE t."internalOnly"=false AND t."requiredPermission" IN (
        SELECT c."permissionType" FROM consents c
         WHERE c."granteeId"='u_ws' AND c.status='ACTIVE' AND c."elderId"=t."elderId")
        AND t."requiredPermission"='LIFE_RECORD')::text
  UNION ALL SELECT '6. 撤回后历史授权记录是否仍保留（原始记录永远保留）','1',
    (SELECT count(*) FROM consents WHERE id='cs8' AND status='REVOKED')::text
  UNION ALL SELECT '7. 王女士可见的对外时间线条数（内部记录不出现）','2',
    (SELECT count(*) FROM timeline_events t
      WHERE t."internalOnly"=false AND EXISTS (
        SELECT 1 FROM consents c WHERE c."granteeId"='u_wd' AND c.status='ACTIVE'
          AND c."elderId"=t."elderId" AND c."permissionType"=t."requiredPermission"))::text
  UNION ALL SELECT '8. 李晨（专员）可见的家庭数（只应是自己负责的）','1',
    (SELECT count(*) FROM households h WHERE h."deletedAt" IS NULL
      AND (h."primarySpecialistId"='sp_li' OR h."backupSpecialistId"='sp_li'))::text
  UNION ALL SELECT '9. 李晨可访问的健康敏感信息条数（一线专员一律为 0）','0',
    (SELECT count(*) FROM elder_sensitive_info s
      JOIN elders e ON e.id=s."elderId"
      JOIN households h ON h.id=e."householdId"
      WHERE h."primarySpecialistId"='sp_li'
        AND EXISTS (SELECT 1 FROM staff_profiles sp JOIN users u ON u.id=sp."userId"
                     WHERE sp.id='sp_li' AND u.role IN ('SUPER_ADMIN','SERVICE_SUPERVISOR')))::text
  UNION ALL SELECT '10. 周敏可见的王家任务数（专员之间隔离）','0',
    (SELECT count(*) FROM service_tasks t WHERE t."householdId"='h_wang' AND t."staffProfileId"='sp_zhou')::text
  UNION ALL SELECT '11. 已发布报告的原始记录溯源条数（报告必须可追溯到原始记录）','1',
    (SELECT count(*) FROM assurance_report_sources WHERE "reportId"='rp1')::text
  UNION ALL SELECT '12. 健康数值缺少来源标注的条数（每条必须有来源）','0',
    (SELECT count(*) FROM health_readings WHERE source IS NULL)::text
  UNION ALL SELECT '13. 超出家庭设定范围的数值条数（仅提醒，不是诊断）','1',
    (SELECT count(*) FROM health_readings WHERE "outsideFamilyRange"=true)::text
  UNION ALL SELECT '14. 查看敏感信息是否留下操作日志','1',
    (SELECT count(*) FROM audit_logs WHERE action='elder.sensitive.read' AND "resourceId"='e_wm')::text
  UNION ALL SELECT '15. 家庭可自助申请的服务类型数（其余不得开放）','2',
    (SELECT count(*) FROM service_catalog_items WHERE "familyRequestable"=true AND "isActive"=true)::text
  UNION ALL SELECT '16. 开放自助申请但没有加购价格的类型数（应为 0）','0',
    (SELECT count(*) FROM service_catalog_items WHERE "familyRequestable"=true AND "addOnPrice" IS NULL)::text
  UNION ALL SELECT '17. 通知模板启用了未实现渠道的条数（第一版仅站内）','0',
    (SELECT count(*) FROM notification_templates
      WHERE "enabledChannels" && '{SMS,WECHAT,WECOM}'::"NotificationChannel"[])::text
  UNION ALL SELECT '18. 报告类通知模板是否绑定了所需授权','1',
    (SELECT count(*) FROM notification_templates WHERE event='REPORT_PUBLISHED' AND "requiredPermission"='ASSURANCE_REPORT')::text
  UNION ALL SELECT '19. 待开票订单数（发票为人工流程，状态可追踪）','1',
    (SELECT count(*) FROM orders WHERE "invoiceStatus"='REQUESTED')::text
  UNION ALL SELECT '20. 已开票但没有发票号的订单数（应为 0）','0',
    (SELECT count(*) FROM orders WHERE "invoiceStatus"='ISSUED' AND "invoiceNo" IS NULL)::text
  UNION ALL SELECT '21. 服务照片是否只存对象存储 key（不得是公开 URL）','1',
    (SELECT count(*) FROM visit_records WHERE 'private/visits/vr1/1.jpg' = ANY("photoKeys")
       AND NOT EXISTS (SELECT 1 FROM visit_records v2, unnest(v2."photoKeys") k WHERE k LIKE 'http%'))::text
  UNION ALL SELECT '22. 未经审核就发布的报告数（应为 0）','0',
    (SELECT count(*) FROM assurance_reports WHERE status='PUBLISHED' AND "householdId"='h_wang' AND "reviewedById" IS NULL)::text
)
SELECT 检查项, 预期, 实际, CASE WHEN 预期=实际 THEN '✅' ELSE '❌ 不符' END AS 结果 FROM q;
