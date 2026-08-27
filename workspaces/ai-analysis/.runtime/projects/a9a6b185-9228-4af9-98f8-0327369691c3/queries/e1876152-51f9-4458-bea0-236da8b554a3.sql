SELECT channel, SUM(paid_amount) AS gmv FROM data GROUP BY channel LIMIT 5000
