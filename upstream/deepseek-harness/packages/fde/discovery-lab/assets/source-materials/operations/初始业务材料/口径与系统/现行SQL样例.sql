-- ANALYST-Q01：已有分析沙箱 SQL，非未来产品技术选型。
-- PostgreSQL 风格；业务自然日以 Asia/Shanghai 为准。参数 end_date 为排他边界。
-- 已退单仍有付款事实；原始 financial_status='paid' 会漏计。
WITH ss AS (
 SELECT channel_id, COUNT(DISTINCT session_id) AS session_count
 FROM sessions WHERE date >= :start_date AND date < :end_date GROUP BY channel_id
), pp AS (
 SELECT channel_id, COUNT(DISTINCT session_id) AS paying_sessions,
 COUNT(DISTINCT order_id) AS paid_orders,SUM(payable_fen) AS paid_gmv_fen
 FROM orders WHERE paid_at IS NOT NULL AND paid_at <> '' AND is_test = 0
 AND date >= :start_date AND date < :end_date GROUP BY channel_id
)
SELECT ss.channel_id,ss.session_count,COALESCE(pp.paid_orders,0) AS paid_orders,
 COALESCE(pp.paying_sessions,0)*1.0/NULLIF(ss.session_count,0) AS conversion,
 COALESCE(pp.paid_gmv_fen,0) AS paid_gmv_fen
FROM ss LEFT JOIN pp USING(channel_id);

-- ANALYST-Q02：退款处理日流出；不是订单所属周退货率。
SELECT SUBSTR(processed_at,1,10) AS refund_date,SUM(refund_fen) AS refund_cash_fen
FROM refunds WHERE status='succeeded'
AND SUBSTR(processed_at,1,10)>=:start_date AND SUBSTR(processed_at,1,10)<:end_date
GROUP BY SUBSTR(processed_at,1,10);
