// ================================================================
// Tab 4: 转子铁心-转轴过盈配合 — UI 桥接函数
// 所有计算均调用 rotor-shaft-calc.js 暴露的函数
// 禁止在页面内编写任何计算公式
// ================================================================

function calcRotorShaftUI() {
  const d = parseFloat(document.getElementById('rs-input-d').value) || 0;
  const d_i = parseFloat(document.getElementById('rs-input-di').value) || 0;
  const d_o = parseFloat(document.getElementById('rs-input-do').value) || 0;
  const L = parseFloat(document.getElementById('rs-input-L').value) || 0;
  const delta = parseFloat(document.getElementById('rs-input-delta').value) || 0;
  const shaftMat = document.getElementById('rs-input-shaft').value;
  const coreMat = document.getElementById('rs-input-core').value;
  const speed = parseFloat(document.getElementById('rs-input-speed').value) || 0;
  const torque = parseFloat(document.getElementById('rs-input-torque').value) || 0;
  const asm = document.getElementById('rs-input-asm').value;
  const load = document.getElementById('rs-input-load').value;
  const T_core = parseFloat(document.getElementById('rs-input-Tcore').value) || 0;
  const T_shaft = parseFloat(document.getElementById('rs-input-Tshaft').value) || 0;
  const T_amb = parseFloat(document.getElementById('rs-input-Tamb').value) || 0;
  const sigmaCore = parseFloat(document.getElementById('rs-input-sigmaCore').value) || 0;
  const sigmaShaft = parseFloat(document.getElementById('rs-input-sigmaShaft').value) || 0;

  if (!d || !d_o || !L || !delta) { alert('请填写所有必填参数'); return; }

  // 处理自定义材料
  let customRSMaterials = null;
  if (shaftMat === 'custom' || coreMat === 'custom') {
    customRSMaterials = {};
    if (shaftMat === 'custom') {
      customRSMaterials.shaft = {
        E_MPa: readCustomVal('csrs-E'),
        nu: readCustomVal('csrs-nu'),
        alpha_perK: readCustomVal('csrs-alpha'),
        sigma_s_MPa: readCustomVal('csrs-sigmaS'),
        sigma_b_compress: readCustomVal('csrs-sigmaBC'),
        name: '自定义轴'
      };
    }
    if (coreMat === 'custom') {
      customRSMaterials.core = {
        E_MPa: readCustomVal('csrc-E'),
        nu: readCustomVal('csrc-nu'),
        alpha_perK: readCustomVal('csrc-alpha'),
        rho_kgm3: readCustomVal('csrc-rho'),
        sigma_b_tensile: readCustomVal('csrc-sigmaB'),
        name: '自定义铁心'
      };
    }
  }

  let result;
  try {
    result = calcRotorShaft({
      d, d_i, d_o, L, delta_um: delta,
      shaftMaterial: shaftMat, coreMaterial: coreMat,
      speed_rpm: speed, torque,
      T_core, T_shaft, T_amb,
      assemblyMethod: asm, loadType: load,
      manualAllow: { sigma_t_core: sigmaCore || undefined, sigma_c_shaft: sigmaShaft || undefined },
      customMaterials: customRSMaterials
    });
  } catch(e) { alert('计算出错: ' + e.message); console.error(e); return; }

  if (result.error) { alert(result.message); return; }
  renderRotorShaftResults(result);
  document.getElementById('results-rotor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderRotorShaftResults(r) {
  const c = document.getElementById('results-rotor');
  function sc(s) { return s.startsWith('合格') ? 'status-qualified' : (s.startsWith('警告') ? 'status-warning' : 'status-fail'); }

  let h = '';
  // Card 1: 过盈与接触压力
  h += `<div class="section-card">
    <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      📐 过盈量与接触压力 — d=${r.input.d}mm, δ=${r.input.delta_um}μm
      <span style="font-size:0.75rem;color:var(--text-light)">▼</span></div>
    <div class="section-body">
      <table class="param-table">
        <tr><td>名义过盈量 δ</td><td>${r.input.delta_um} μm</td></tr>
        <tr><td>离心力释放 δ<sub>ω</sub></td><td style="color:${r.centrifugal.delta_loss_um > 1 ? 'var(--warning)' : 'inherit'}">−${r.centrifugal.delta_loss_um} μm</td></tr>
        <tr><td>温度变化 Δδ<sub>T</sub></td><td style="color:${r.pressure.delta_thermal_um < 0 ? 'var(--warning)' : 'inherit'}">${r.pressure.delta_thermal_um} μm</td></tr>
        <tr><td>有效过盈量 δ<sub>eff</sub></td><td><strong>${r.pressure.delta_effective_um} μm</strong></td></tr>
        <tr><td>名义接触压力 p</td><td><strong>${r.pressure.p_nominal_MPa} MPa</strong></td></tr>
        <tr><td>有效接触压力 p<sub>eff</sub></td><td><strong>${r.pressure.p_effective_MPa} MPa</strong></td></tr>
      </table>
      ${r.pressure.p_effective_MPa <= 0 ? '<div class="alert alert-danger">⚠️ 有效接触压力≤0！转速或温升导致过盈完全丧失。</div>' : ''}
      ${r.centrifugal.delta_loss_um > r.input.delta_um * 0.3 ? `<div class="alert alert-warning" style="margin-top:6px">${r.centrifugal.note}</div>` : ''}
    </div></div>`;

  // Card 2: 应力分析
  h += `<div class="section-card">
    <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      📊 应力分析 — <span style="color:${r.stress.core.eval.status !== '合格' ? 'var(--danger)' : 'var(--primary)'}">铁心是关键</span>
      <span style="font-size:0.75rem;color:var(--text-light)">▼</span></div>
    <div class="section-body">
      <table class="param-table">
        <tr><th>位置</th><th>应力类型</th><th>数值 (MPa)</th><th>安全系数</th><th>判定</th></tr>
        <tr style="background:#fff8f0"><td>铁心配合面(内壁)</td><td>周向拉 σ<sub>t</sub></td>
          <td style="font-family:var(--font-mono);color:var(--danger)"><strong>${r.stress.core.sigma_t_inner_MPa}</strong></td>
          <td style="font-family:var(--font-mono)"><strong>${r.stress.core.eval.safetyFactor}</strong></td>
          <td><span class="status-badge ${sc(r.stress.core.eval.status)}">${r.stress.core.eval.status} ≥${r.stress.core.eval.threshold}</span></td></tr>
        <tr><td>铁心外圆</td><td>周向 σ<sub>t</sub></td><td style="font-family:var(--font-mono)">${r.stress.core.sigma_t_outer_MPa}</td><td>—</td><td>—</td></tr>
        <tr><td>铁心内壁</td><td>径向 σ<sub>r</sub></td><td style="font-family:var(--font-mono)">${r.stress.core.sigma_r_MPa}</td><td>—</td><td>—</td></tr>
        <tr><td>轴表面</td><td>周向压 σ<sub>t</sub></td><td style="font-family:var(--font-mono)">${r.stress.shaft.sigma_t_MPa}</td>
          <td style="font-family:var(--font-mono)">${r.stress.shaft.eval.safetyFactor}</td>
          <td><span class="status-badge ${sc(r.stress.shaft.eval.status)}">${r.stress.shaft.eval.status}</span></td></tr>
      </table>
      ${r.stress.core.eval.status !== '合格' ? `<div class="alert alert-danger" style="margin-top:8px">${r.stress.core.eval.note}</div>` : ''}
      <div class="alert ${r.centrifugal.sigma_outer_MPa > 50 ? 'alert-warning' : 'alert-info'}" style="margin-top:6px">
        📐 离心效应详情：${r.centrifugal.note}<br>
        铁心外圆离心拉应力叠加后：σ<sub>t_outer_total</sub> = ${r.stress.core.sigma_t_outer_MPa} MPa</div>
    </div></div>`;

  // Card 3: 扭矩传递 + 装配
  h += `<div class="section-card">
    <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      🔧 ${r.torqueCheck ? '扭矩传递 + ' : ''}装配
      <span style="font-size:0.75rem;color:var(--text-light)">▼</span></div>
    <div class="section-body">
      <div class="info-row"><span class="label">材料</span><span class="value">${r.materials.shaft.name} + ${r.materials.core.name}</span></div>
      <div class="info-row"><span class="label">摩擦系数</span><span class="value">f = ${r.materials.friction.f} (${r.materials.friction.f_range})</span></div>
      <div class="info-row"><span class="label">许用应力</span><span class="value">铁心[σ<sub>t</sub>]=${r.allowables.coreTensile_MPa}MPa (${r.allowables.coreTensileSource}), 轴[σ<sub>c</sub>]=${r.allowables.shaftCompress_MPa}MPa</span></div>
      <hr class="section-divider">`;
  if (r.torqueCheck) {
    h += `<div class="info-row"><span class="label">所需p</span><span class="value">${r.torqueCheck.p_required_MPa} MPa (K=${r.torqueCheck.K_slip})</span></div>
      <div class="info-row"><span class="label">扭矩裕度</span><span class="value">${r.torqueCheck.margin} (δ_eff/δ_req)</span></div>
      <span class="status-badge ${sc(r.torqueCheck.status)}">${r.torqueCheck.status}</span>`;
  }
  if (r.assembly.heatingTemp_degC) {
    h += `<div class="alert alert-info" style="margin-top:8px">🔥 ${r.assembly.heatingNote}</div>`;
  }
  if (r.assembly.pressForceNote) {
    h += `<div class="alert alert-info" style="margin-top:6px">${r.assembly.pressForceNote}</div>`;
  }
  h += `</div></div>`;

  // Card 4: 计算详情
  h += `<div class="section-card collapsed">
    <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      📝 中间计算详情 <span style="font-size:0.75rem;color:var(--text-light)">▶ 展开</span></div>
    <div class="section-body" style="font-size:0.8rem">
      <div class="formula-block"><span class="formula-label">① 刚度系数</span>${r.stiffness.formula}<br>C₁(轴) = ${r.stiffness.C1}, C₂(铁心) = ${r.stiffness.C2}</div>
      <div class="formula-block"><span class="formula-label">② 接触压力 p = δ/1000 / [d×(C₁/E₁+C₂/E₂)]</span>
        = ${r.input.delta_um}/1000 / [${r.input.d}×(${r.stiffness.C1}/${r.materials.shaft.E_MPa}+${r.stiffness.C2}/${r.materials.core.E_MPa})]
        = <strong>${r.pressure.p_nominal_MPa} MPa</strong></div>
      <div class="formula-block"><span class="formula-label">③ 铁心周向拉应力 σ_t = p×(d_o²+d²)/(d_o²−d²)</span>
        = ${r.pressure.p_nominal_MPa}×(${r.input.d_o}²+${r.input.d}²)/(${r.input.d_o}²−${r.input.d}²)
        = <strong style="color:var(--danger)">${r.stress.core.sigma_t_inner_MPa} MPa</strong></div>
      <div class="formula-block"><span class="formula-label">④ 离心位移 u_ω ≈ ρω²d³(3+ν)(1+(d/do)²) / (32E)</span>
        ω = ${r.centrifugal.omega_rad_s} rad/s, v_tip = ${r.centrifugal.tipSpeed_ms} m/s<br>
        = <strong>${r.centrifugal.delta_loss_um} μm</strong> (过盈损失)</div>
      <div class="formula-block"><span class="formula-label">⑤ 轴周向压应力 σ_t_shaft = −p (实心轴)</span>
        = <strong>${r.stress.shaft.sigma_t_MPa} MPa</strong>
        &nbsp;|&nbsp; n<sub>shaft</sub> = ${r.stress.shaft.eval.safetyFactor}</div>
    </div></div>`;

  c.innerHTML = h;
}

function resetRotorShaft() {
  document.getElementById('rs-input-d').value = '50';
  document.getElementById('rs-input-di').value = '0';
  document.getElementById('rs-input-do').value = '150';
  document.getElementById('rs-input-L').value = '120';
  document.getElementById('rs-input-delta').value = '30';
  document.getElementById('rs-input-shaft').value = '45钢';
  document.getElementById('rs-input-core').value = '硅钢片叠层_B50A470';
  document.getElementById('rs-input-speed').value = '3000';
  document.getElementById('rs-input-torque').value = '200';
  document.getElementById('rs-input-asm').value = 'shrinkFit';
  document.getElementById('rs-input-load').value = 'dynamic';
  document.getElementById('rs-input-Tcore').value = '100';
  document.getElementById('rs-input-Tshaft').value = '80';
  document.getElementById('rs-input-Tamb').value = '20';
  document.getElementById('rs-input-sigmaCore').value = '0';
  document.getElementById('rs-input-sigmaShaft').value = '0';
  // 隐藏自定义材料面板
  var rsShaft = document.getElementById('custom-rs-shaft');
  var rsCore = document.getElementById('custom-rs-core');
  if (rsShaft) rsShaft.style.display = 'none';
  if (rsCore) rsCore.style.display = 'none';
  document.getElementById('results-rotor').innerHTML = '<div class="empty-state"><div class="icon">🔄</div><p>输入参数后点击 <strong>"开始校核"</strong></p></div>';
}

function loadRSExample(type) {
  if (type === 'standard') {
    document.getElementById('rs-input-d').value = '50'; document.getElementById('rs-input-di').value = '0';
    document.getElementById('rs-input-do').value = '150'; document.getElementById('rs-input-L').value = '120';
    document.getElementById('rs-input-delta').value = '30'; document.getElementById('rs-input-shaft').value = '45钢';
    document.getElementById('rs-input-core').value = '硅钢片叠层_B50A470'; document.getElementById('rs-input-speed').value = '3000';
    document.getElementById('rs-input-torque').value = '200'; document.getElementById('rs-input-asm').value = 'shrinkFit';
    document.getElementById('rs-input-load').value = 'dynamic';
  } else if (type === 'servo') {
    document.getElementById('rs-input-d').value = '70'; document.getElementById('rs-input-di').value = '20';
    document.getElementById('rs-input-do').value = '180'; document.getElementById('rs-input-L').value = '150';
    document.getElementById('rs-input-delta').value = '45'; document.getElementById('rs-input-shaft').value = '40Cr';
    document.getElementById('rs-input-core').value = '硅钢片叠层_B35A300'; document.getElementById('rs-input-speed').value = '6000';
    document.getElementById('rs-input-torque').value = '500'; document.getElementById('rs-input-asm').value = 'shrinkFit';
    document.getElementById('rs-input-load').value = 'reversing';
  } else {
    document.getElementById('rs-input-d').value = '40'; document.getElementById('rs-input-di').value = '0';
    document.getElementById('rs-input-do').value = '100'; document.getElementById('rs-input-L').value = '90';
    document.getElementById('rs-input-delta').value = '20'; document.getElementById('rs-input-shaft').value = '42CrMo';
    document.getElementById('rs-input-core').value = '硅钢片叠层_B35A300'; document.getElementById('rs-input-speed').value = '15000';
    document.getElementById('rs-input-torque').value = '100'; document.getElementById('rs-input-asm').value = 'shrinkFit';
    document.getElementById('rs-input-load').value = 'highSpeed';
  }
  calcRotorShaftUI();
}
