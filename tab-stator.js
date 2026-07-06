// ================================================================
// Tab 3: 定子铁心-机座过盈配合 — UI 桥接函数
// 所有计算均调用 stator-frame-calc.js 暴露的函数
// 禁止在页面内编写任何计算公式
// ================================================================

function calcStatorFrameUI() {
  const d = parseFloat(document.getElementById('sf-input-d').value) || 0;
  const d_i = parseFloat(document.getElementById('sf-input-di').value) || 0;
  const d_o = parseFloat(document.getElementById('sf-input-do').value) || 0;
  const L = parseFloat(document.getElementById('sf-input-L').value) || 0;
  const delta = parseFloat(document.getElementById('sf-input-delta').value) || 0;
  const coreMat = document.getElementById('sf-input-core').value;
  const frameMat = document.getElementById('sf-input-frame').value;
  const asm = document.getElementById('sf-input-asm').value;
  const load = document.getElementById('sf-input-load').value;
  const T_op = parseFloat(document.getElementById('sf-input-Top').value) || 0;
  const T_amb = parseFloat(document.getElementById('sf-input-Tamb').value) || 0;
  const torque = parseFloat(document.getElementById('sf-input-torque').value) || 0;
  const sigmaCore = parseFloat(document.getElementById('sf-input-sigmaCore').value) || 0;
  const sigmaFrame = parseFloat(document.getElementById('sf-input-sigmaFrame').value) || 0;

  if (!d || !d_o || !L || !delta) { alert('请填写所有必填参数'); return; }

  // 处理自定义材料
  let customMaterials = null;
  if (coreMat === 'custom' || frameMat === 'custom') {
    customMaterials = {};
    if (coreMat === 'custom') {
      customMaterials.core = {
        E_MPa: readCustomVal('csfc-E'),
        nu: readCustomVal('csfc-nu'),
        alpha_perK: readCustomVal('csfc-alpha'),
        sigma_b_tensile: readCustomVal('csfc-sigmaB'),
        name: '自定义铁心'
      };
    }
    if (frameMat === 'custom') {
      customMaterials.frame = {
        E_MPa: readCustomVal('csff-E'),
        nu: readCustomVal('csff-nu'),
        alpha_perK: readCustomVal('csff-alpha'),
        sigma_s_MPa: readCustomVal('csff-sigmaS'),
        sigma_b_tensile: readCustomVal('csff-sigmaB'),
        name: '自定义机座'
      };
      var ff = document.getElementById('csff-friction').value;
      if (ff) customMaterials.frictionPair = ff;
    }
  }

  let result;
  try {
    result = calcStatorFrame({
      d, d_i, d_o, L, delta_um: delta,
      coreMaterial: coreMat, frameMaterial: frameMat,
      torque, T_op, T_amb,
      assemblyMethod: asm, loadType: load,
      manualAllow: { sigma_t_core: sigmaCore || undefined, sigma_t_frame: sigmaFrame || undefined },
      customMaterials: customMaterials
    });
  } catch(e) { alert('计算出错: ' + e.message); console.error(e); return; }

  if (result.error) { alert(result.message); return; }
  renderStatorFrameResults(result);
  document.getElementById('results-stator').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderStatorFrameResults(r) {
  const c = document.getElementById('results-stator');
  function sc(s) { return s.startsWith('合格') ? 'status-qualified' : (s.startsWith('警告') ? 'status-warning' : 'status-fail'); }

  let h = '';
  // Card 1: 接触压力与过盈
  h += `<div class="section-card">
    <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      📐 过盈量与接触压力 — d=${r.input.d}mm, δ=${r.input.delta_um}μm
      <span style="font-size:0.75rem;color:var(--text-light)">▼</span></div>
    <div class="section-body">
      <table class="param-table">
        <tr><td>名义过盈量 δ</td><td>${r.input.delta_um} μm</td></tr>
        <tr><td>温度引起变化 Δδ<sub>T</sub></td><td>${r.pressure.delta_thermal_um} μm</td></tr>
        <tr><td>有效过盈量 δ<sub>eff</sub></td><td><strong>${r.pressure.delta_effective_um} μm</strong></td></tr>
        <tr><td>名义接触压力 p</td><td><strong>${r.pressure.p_nominal_MPa} MPa</strong></td></tr>
        <tr><td>有效接触压力 p<sub>eff</sub></td><td><strong>${r.pressure.p_effective_MPa} MPa</strong></td></tr>
        <tr><td colspan="2"><div class="alert ${r.pressure.delta_thermal_um < 0 ? 'alert-warning' : 'alert-info'}">${r.pressure.note}</div></td></tr>
        ${r.pressure.p_effective_MPa <= 0 ? '<tr><td colspan="2"><div class="alert alert-danger">⚠️ 有效接触压力为0或负值！工作温度下过盈可能完全丧失。</div></td></tr>' : ''}
      </table></div></div>`;

  // Card 2: 应力分析
  h += `<div class="section-card">
    <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      📊 应力分析
      <span style="font-size:0.75rem;color:var(--text-light)">▼</span></div>
    <div class="section-body">
      <table class="param-table">
        <tr><th>位置</th><th>应力类型</th><th>数值 (MPa)</th><th>安全系数</th><th>判定</th></tr>
        <tr><td>铁心配合面</td><td>周向 σ<sub>t</sub></td><td style="font-family:var(--font-mono)">${r.stress.core.sigma_t_outer_MPa}</td><td>—</td><td><span class="status-badge status-qualified">受压 ✓</span></td></tr>
        ${r.stress.core.sigma_t_bore_MPa > 0
          ? `<tr style="background:#fff8f0"><td>铁心内孔</td><td>周向拉 σ<sub>t</sub></td><td style="font-family:var(--font-mono);color:var(--danger)">${r.stress.core.sigma_t_bore_MPa}</td>
            <td style="font-family:var(--font-mono)">${r.stress.coreBoreEval ? r.stress.coreBoreEval.safetyFactor : '—'}</td>
            <td><span class="status-badge ${r.stress.coreBoreEval && r.stress.coreBoreEval.status === '合格' ? 'status-qualified' : 'status-warning'}">${r.stress.coreBoreEval ? r.stress.coreBoreEval.status : '需检查'}</span></td></tr>`
          : '<tr><td>铁心内孔</td><td>周向</td><td style="font-family:var(--font-mono)">—</td><td>—</td><td><span class="status-badge status-qualified">实心/无拉应力</span></td></tr>'}
        <tr><td>铁心配合面</td><td>径向 σ<sub>r</sub></td><td style="font-family:var(--font-mono)">${r.stress.core.sigma_r_MPa}</td><td>—</td><td>—</td></tr>
        <tr style="background:#fafbfc"><td>机座内壁</td><td>周向拉 σ<sub>t</sub></td><td style="font-family:var(--font-mono)"><strong>${r.stress.frame.sigma_t_max_MPa}</strong></td>
          <td style="font-family:var(--font-mono)">${r.stress.frame.eval.safetyFactor}</td>
          <td><span class="status-badge ${sc(r.stress.frame.eval.status)}">${r.stress.frame.eval.status} ≥${r.stress.frame.eval.threshold}</span></td></tr>
        <tr><td>机座内壁</td><td>径向 σ<sub>r</sub></td><td style="font-family:var(--font-mono)">${r.stress.frame.sigma_r_inner_MPa}</td><td>—</td><td>—</td></tr>
      </table>
      ${r.stress.core.sigma_t_bore_MPa > 0 ? `<div class="alert alert-warning" style="margin-top:8px">${r.stress.core.note}</div>` : ''}
      ${r.stress.frame.eval.status !== '合格' ? `<div class="alert alert-danger" style="margin-top:8px">⚠️ 机座周向拉应力安全系数不足！${r.stress.frame.eval.note}</div>` : ''}
    </div></div>`;

  // Card 3: 扭矩传递 + 装配
  h += `<div class="section-card">
    <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      🔧 ${r.torqueCheck ? '扭矩传递 + ' : ''}装配参数
      <span style="font-size:0.75rem;color:var(--text-light)">▼</span></div>
    <div class="section-body">
      <div class="info-row"><span class="label">材料</span><span class="value">${r.materials.inner.name} + ${r.materials.outer.name}</span></div>
      <div class="info-row"><span class="label">摩擦系数</span><span class="value">f = ${r.materials.friction.f} (${r.materials.friction.method}, 范围 ${r.materials.friction.f_range})</span></div>
      <div class="info-row"><span class="label">刚度系数</span><span class="value">C₁=${r.stiffness.C1}, C₂=${r.stiffness.C2}</span></div>
      <hr class="section-divider">`;
  if (r.torqueCheck) {
    h += `<div class="info-row"><span class="label">所需接触压力</span><span class="value">${r.torqueCheck.p_required_MPa} MPa (K=${r.torqueCheck.K_slip})</span></div>
      <div class="info-row"><span class="label">扭矩传递裕度</span><span class="value" style="color:${r.torqueCheck.margin >= 1.3 ? 'var(--success)' : (r.torqueCheck.margin >= 1.0 ? 'var(--warning)' : 'var(--danger)')}">${r.torqueCheck.margin} (δ_eff/δ_req)</span></div>
      <div class="status-badge ${sc(r.torqueCheck.status)}" style="margin-top:4px">${r.torqueCheck.status}</div>`;
  }
  if (r.stress.assembly.heatingTemp_degC) {
    h += `<div class="alert alert-info" style="margin-top:8px">🔥 ${r.stress.assembly.heatingNote}
      <br>📐 装配应力 p=${r.stress.assembly.p_assembly_MPa} MPa, σ_t=${r.stress.assembly.sigma_t_frame_assembly_MPa} MPa</div>`;
  }
  h += `</div></div>`;

  // Card 4: 计算详情
  h += `<div class="section-card collapsed">
    <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      📝 中间计算详情 <span style="font-size:0.75rem;color:var(--text-light)">▶ 展开</span></div>
    <div class="section-body" style="font-size:0.8rem">
      <div class="formula-block"><span class="formula-label">① 刚度系数</span>${r.stiffness.formula}<br>C₁ = ${r.stiffness.C1}, C₂ = ${r.stiffness.C2}</div>
      <div class="formula-block"><span class="formula-label">② 接触压力 p = δ/1000 / [d×(C₁/E₁+C₂/E₂)]</span>
        = ${r.input.delta_um}/1000 / [${r.input.d}×(${r.stiffness.C1}/${r.materials.inner.E_MPa}+${r.stiffness.C2}/${r.materials.outer.E_MPa})]
        = <strong>${r.pressure.p_nominal_MPa} MPa</strong></div>
      <div class="formula-block"><span class="formula-label">③ 温度效应 Δδ = d×(α₂−α₁)×(T−T₀)</span>
        α₂(${r.materials.outer.name})=${r.materials.outer.alpha_perK}×10⁻⁶, α₁(${r.materials.inner.name})=${r.materials.inner.alpha_perK}×10⁻⁶<br>
        = <strong>${r.pressure.delta_thermal_um} μm</strong> (${r.pressure.delta_thermal_um < 0 ? '外件膨胀更大→过盈减小' : '内件膨胀更大→过盈增加'})</div>
      <div class="formula-block"><span class="formula-label">④ 机座周向应力 σ_t = p×(d_o²+d²)/(d_o²−d²)</span>
        = ${r.pressure.p_nominal_MPa}×(${r.input.d_o}²+${r.input.d}²)/(${r.input.d_o}²−${r.input.d}²) = <strong>${r.stress.frame.sigma_t_max_MPa} MPa</strong></div>
      ${r.stress.core.sigma_t_bore_MPa > 0 ? `<div class="formula-block"><span class="formula-label">⑤ 铁心内孔周向拉应力 σ_t = −2p/(1−(d_i/d)²)</span>
        = −2×${r.pressure.p_nominal_MPa}/(1−(${r.input.d_i}/${r.input.d})²) = <strong style="color:var(--danger)">${r.stress.core.sigma_t_bore_MPa} MPa</strong> ← 危险点！</div>` : ''}
    </div></div>`;

  c.innerHTML = h;
}

function resetStatorFrame() {
  document.getElementById('sf-input-d').value = '210';
  document.getElementById('sf-input-di').value = '130';
  document.getElementById('sf-input-do').value = '260';
  document.getElementById('sf-input-L').value = '160';
  document.getElementById('sf-input-delta').value = '50';
  document.getElementById('sf-input-core').value = '硅钢片叠层_B50A470';
  document.getElementById('sf-input-frame').value = '铝合金_6061-T6';
  document.getElementById('sf-input-asm').value = 'shrinkFit';
  document.getElementById('sf-input-load').value = 'dynamic';
  document.getElementById('sf-input-Top').value = '120';
  document.getElementById('sf-input-Tamb').value = '20';
  document.getElementById('sf-input-torque').value = '0';
  document.getElementById('sf-input-sigmaCore').value = '0';
  document.getElementById('sf-input-sigmaFrame').value = '0';
  // 隐藏自定义材料面板
  var sfCore = document.getElementById('custom-sf-core');
  var sfFrame = document.getElementById('custom-sf-frame');
  if (sfCore) sfCore.style.display = 'none';
  if (sfFrame) sfFrame.style.display = 'none';
  document.getElementById('results-stator').innerHTML = '<div class="empty-state"><div class="icon">🏗️</div><p>输入参数后点击 <strong>"开始校核"</strong></p></div>';
}

function loadSFExample(type) {
  if (type === 'alu') {
    document.getElementById('sf-input-d').value = '210'; document.getElementById('sf-input-di').value = '130';
    document.getElementById('sf-input-do').value = '260'; document.getElementById('sf-input-L').value = '160';
    document.getElementById('sf-input-delta').value = '50'; document.getElementById('sf-input-core').value = '硅钢片叠层_B50A470';
    document.getElementById('sf-input-frame').value = '铝合金_6061-T6'; document.getElementById('sf-input-asm').value = 'shrinkFit';
    document.getElementById('sf-input-load').value = 'dynamic'; document.getElementById('sf-input-Top').value = '120';
    document.getElementById('sf-input-Tamb').value = '20'; document.getElementById('sf-input-torque').value = '500';
  } else if (type === 'castiron') {
    document.getElementById('sf-input-d').value = '260'; document.getElementById('sf-input-di').value = '170';
    document.getElementById('sf-input-do').value = '320'; document.getElementById('sf-input-L').value = '200';
    document.getElementById('sf-input-delta').value = '40'; document.getElementById('sf-input-core').value = '硅钢片叠层_B35AV1900';
    document.getElementById('sf-input-frame').value = '铸铁_HT200'; document.getElementById('sf-input-asm').value = 'shrinkFit';
    document.getElementById('sf-input-load').value = 'static'; document.getElementById('sf-input-Top').value = '100';
    document.getElementById('sf-input-Tamb').value = '20'; document.getElementById('sf-input-torque').value = '0';
  } else {
    document.getElementById('sf-input-d').value = '400'; document.getElementById('sf-input-di').value = '280';
    document.getElementById('sf-input-do').value = '480'; document.getElementById('sf-input-L').value = '300';
    document.getElementById('sf-input-delta').value = '80'; document.getElementById('sf-input-core').value = '硅钢片叠层_B35A300';
    document.getElementById('sf-input-frame').value = '结构钢_Q345'; document.getElementById('sf-input-asm').value = 'shrinkFit';
    document.getElementById('sf-input-load').value = 'dynamic'; document.getElementById('sf-input-Top').value = '130';
  }
  calcStatorFrameUI();
}
