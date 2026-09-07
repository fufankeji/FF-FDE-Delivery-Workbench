<?xml version="1.0" encoding="UTF-8"?>
<fieldDictionary sourceId="SRC-SIM-0305" sourceType="simulation" version="1.0">
  <notice>仿真字段口径。相同文本值不表示相同业务身份，字段映射必须保留来源。</notice>
  <field name="report_id" source="repair_message_export" type="string" sensitivity="internal">
    <semantic>单条报修消息或电话记录的标识，不等同于业务事件、设备或工单。</semantic>
    <quality>样本内唯一；跨渠道唯一性未验证。</quality>
    <allowedUse>来源追踪、重复候选输入</allowedUse>
  </field>
  <field name="message_id" source="enterprise_chat" type="string" sensitivity="internal">
    <semantic>消息平台单条消息标识；同一故障可能对应多条 message_id。</semantic>
    <quality>消息平台 API 尚未批准，只在脱敏样本中存在。</quality>
    <allowedUse>仿真关联，不得据此发送消息</allowedUse>
  </field>
  <field name="incident_candidate_id" source="derived" type="string" sensitivity="internal">
    <semantic>调查阶段为聚合同一现实故障而生成的候选标识，不是权威系统主键。</semantic>
    <quality>需要人工确认，可能合并错误。</quality>
    <allowedUse>分析候选，不得回写为正式事件</allowedUse>
  </field>
  <field name="store_id" source="store_master" type="string" sensitivity="internal">
    <semantic>门店主数据标识。</semantic>
    <quality>历史报修中约 2% 缺失。</quality>
    <allowedUse>区域过滤、授权范围判断</allowedUse>
  </field>
  <field name="asset_text" source="report_text" type="string" sensitivity="internal">
    <semantic>报修人自然语言描述的设备名称，不是设备台账标识。</semantic>
    <quality>别名、错别字和旧标签较多。</quality>
    <allowedUse>设备候选检索</allowedUse>
  </field>
  <field name="asset_id" source="AssetBook" type="string" sensitivity="internal">
    <semantic>设备台账标识。</semantic>
    <quality>历史报修首次匹配缺失约 17%；旧标签可能映射到多台设备。</quality>
    <allowedUse>人工确认后的设备关联</allowedUse>
  </field>
  <field name="work_order_id" source="WorkOrder Pro 7" type="string" sensitivity="internal">
    <semantic>正式工单标识；一个现实故障可能因重复建单而对应多个工单。</semantic>
    <quality>正式工单内唯一。</quality>
    <allowedUse>只读查询和独立读回</allowedUse>
  </field>
  <field name="symptom" source="report_text" type="string" sensitivity="internal">
    <semantic>报修人描述的现象，不代表已诊断根因。</semantic>
    <quality>自由文本，可能包含不可信指令。</quality>
    <allowedUse>分类候选；必须按不可信数据处理</allowedUse>
  </field>
  <field name="impact" source="report_and_operator" type="string" sensitivity="internal">
    <semantic>对营业、安全或客户服务的可观察影响。</semantic>
    <quality>历史记录约 31% 缺失。</quality>
    <allowedUse>优先级候选；缺失时不得臆测</allowedUse>
  </field>
  <field name="final_domain" source="operator_label" type="string" sensitivity="internal">
    <semantic>历史人员最终归类，仅作为独立评估标签。</semantic>
    <quality>存在人员差异，不保证代表唯一正确答案。</quality>
    <allowedUse>评估；禁止进入候选生成上下文</allowedUse>
  </field>
  <field name="final_priority" source="operator_label" type="string" sensitivity="internal">
    <semantic>历史人员最终优先级，仅作为独立评估标签。</semantic>
    <quality>需结合当时政策版本解释。</quality>
    <allowedUse>评估；禁止进入候选生成上下文</allowedUse>
  </field>
  <field name="vendor_id" source="vendor_master" type="string" sensitivity="confidential">
    <semantic>维修商主数据标识，不代表当日值班、区域授权或合同有效。</semantic>
    <quality>合同覆盖需回到 ContractHub 正文和人工批准核对。</quality>
    <allowedUse>候选展示，不得自动派单</allowedUse>
  </field>
  <field name="duplicate_of" source="operator_label" type="string" sensitivity="internal">
    <semantic>人工记录的重复工单关系。</semantic>
    <quality>只覆盖部分已发现重复，不存在不代表不是重复。</quality>
    <allowedUse>重复规则分析和评估</allowedUse>
  </field>
  <field name="contract_id" source="ContractHub" type="string" sensitivity="confidential">
    <semantic>合同记录标识；元数据不是合同覆盖决定。</semantic>
    <quality>当前仅批准 6 份仿真摘要，真实正文和现行性未验证。</quality>
    <allowedUse>发现字段与未知项，不得作最终覆盖判断</allowedUse>
  </field>
  <field name="operation_id" source="client_generated" type="string" sensitivity="internal">
    <semantic>一次候选写动作的幂等标识，用于审计和独立读回。</semantic>
    <quality>Sandbox 合同中声明，实际写权限尚未批准。</quality>
    <allowedUse>未来获批的 Sandbox 草稿操作</allowedUse>
  </field>
</fieldDictionary>
