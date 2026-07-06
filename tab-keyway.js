// ================================================================
// Tab 2: 平键校核 — UI 桥接函数
// 所有计算均调用 key-calc.js 暴露的函数
// 禁止在页面内编写任何计算公式
// ================================================================

// ---- 轴径变化时更新键尺寸提示 ----
function onKeyShaftChange() {
  const d = parseFloat(document.getElementById('key-input-d').value) || 0;
  const hint = document.getElementById('key-dim-hint');

  if (d < 6 || d > 500) {
    hint.className = 'alert alert-danger';
    hint.innerHTML = '⚠️ 轴径超出 GB/T 1096 标准范围 (6~500mm)，请检查输入';
    return;
  }

  const dim = getKeyDimensions(d);
  if (!dim.found) {
    hint.className = 'alert alert-warning';
    hint.innerHTML = '⚠️ ' + dim.error;
    return;
  }

  hint.className = 'alert alert-info';
  hint.innerHTML = `📐 标准键截面：<strong>b × h = ${dim.b} × ${dim.h} mm</strong> &nbsp;|&nbsp;
    轴槽深 t₁ = ${dim.t1} mm &nbsp;|&nbsp; 毂槽深 t₂ = ${dim.t2} mm &nbsp;|&nbsp;
    键长范围 L = ${dim.Lmin}~${dim.Lmax} mm`;

  // 自动更新键长推荐值
  const lengthInput = document.getElementById('key-input-length');
  if (parseFloat(lengthInput.value) <= 0) {
    const rec = getStandardKeyLength(d * 1.5);
    lengthInput.placeholder = `推荐: ${rec} mm (1.5d取标准值)`;
  }
}

// ---- 键型变化时更新键长提示 ----
function onKeyTypeChange() {
  const d = parseFloat(document.getElementById('key-input-d').value) || 0;
  const kt = document.getElementById('key-input-type').value;
  const lengthInput = document.getElementById('key-input-length');
  if (parseFloat(lengthInput.value) <= 0 && d > 0) {
    const dim = getKeyDimensions(d);
    if (dim.found) {
      let rec = getStandardKeyLength(d * 1.5);
      // A型/C型键长应至少比键宽大
      if (kt === 'A' && rec <= dim.b) rec = getStandardKeyLength(dim.b + 10);
      if (kt === 'C' && rec <= dim.b) rec = getStandardKeyLength(dim.b + 6);
      lengthInput.placeholder = `推荐: ${rec} mm`;
    }
  }
}

// ---- 加载平键示例 ----
function loadKeyExample(type) {
  switch(type) {
    case 'motor':
      document.getElementById('key-input-d').value = '50';
      document.getElementById('key-input-type').value = 'A';
      document.getElementById('key-input-length').value = '0';
      document.getElementById('key-input-load').value = 'static';
      document.getElementById('key-input-hub').value = 'steel';
      document.getElementById('key-input-keymat').value = '45钢';
      document.getElementById('key-input-torque').value = '300';
      document.getElementById('key-input-power').value = '45';
      document.getElementById('key-input-speed').value = '1500';
      break;
    case 'reducer':
      document.getElementById('key-input-d').value = '80';
      document.getElementById('key-input-type').value = 'B';
      document.getElementById('key-input-length').value = '0';
      document.getElementById('key-input-load').value = 'lightImpact';
      document.getElementById('key-input-hub').value = 'steel';
      document.getElementById('key-input-keymat').value = '40Cr';
      document.getElementById('key-input-torque').value = '1200';
      document.getElementById('key-input-power').value = '0';
      document.getElementById('key-input-speed').value = '0';
      break;
    case 'heavy':
      document.getElementById('key-input-d').value = '120';
      document.getElementById('key-input-type').value = 'C';
      document.getElementById('key-input-length').value = '0';
      document.getElementById('key-input-load').value = 'heavyImpact';
      document.getElementById('key-input-hub').value = 'castIron';
      document.getElementById('key-input-keymat').value = '40Cr';
      document.getElementById('key-input-torque').value = '3500';
      document.getElementById('key-input-power').value = '0';
      document.getElementById('key-input-speed').value = '0';
      break;
  }
  onKeyShaftChange();
  onKeyTypeChange();
  calcKeyway();
}

// ---- 主校核函数 ----
function calcKeyway() {
  const d = parseFloat(document.getElementById('key-input-d').value);
  const keyType = document.getElementById('key-input-type').value;
  const keyLength = parseFloat(document.getElementById('key-input-length').value) || 0;
  const loadType = document.getElementById('key-input-load').value;
  const hubMaterial = document.getElementById('key-input-hub').value;
  const keyMaterial = document.getElementById('key-input-keymat').value;
  const torque = parseFloat(document.getElementById('key-input-torque').value) || 0;
  const power = parseFloat(document.getElementById('key-input-power').value) || 0;
  const speed = parseFloat(document.getElementById('key-input-speed').value) || 0;

  if (!d || d < 6 || d > 500) { alert('轴径 d 应在 6~500 mm 范围内'); return; }
  if (torque <= 0 && (power <= 0 || speed <= 0)) {
    alert('请输入传递转矩或（功率+转速）'); return;
  }

  // 处理自定义轮毂/键材料
  let customAllow = null, customHubName = null, customKeyName = null;
  if (hubMaterial === 'custom') {
    customHubName = document.getElementById('ck-hubName').value || '自定义轮毂';
    var ckSP = readCustomVal('ck-sigmaP');
    var ckTau = readCustomVal('ck-tau');
    if (ckSP > 0 || ckTau > 0) {
      customAllow = { sigma_p: ckSP || 0, tau: ckTau || 0 };
    }
  }
  if (keyMaterial === 'custom') {
    customKeyName = document.getElementById('ck-keyName').value || '自定义键材料';
  }

  let result;
  try {
    result = calcFlatKey({
      shaftDiameter: d,
      keyType: keyType,
      keyLength: keyLength,
      torque: torque,
      power_kW: power,
      speed_rpm: speed,
      hubMaterial: hubMaterial === 'custom' ? 'steel' : hubMaterial,
      loadType: loadType,
      keyMaterial: keyMaterial === 'custom' ? '45钢' : keyMaterial,
      customAllow: customAllow,
      customHubName: customHubName,
      customKeyName: customKeyName
    });
  } catch (e) {
    alert('计算出错: ' + e.message);
    console.error(e);
    return;
  }

  if (result.error) {
    alert(result.message);
    renderKeywayError(result);
    return;
  }

  renderKeywayResults(result);
  document.getElementById('results-keyway').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- 错误渲染 ----
function renderKeywayError(r) {
  const container = document.getElementById('results-keyway');
  container.innerHTML = `
    <div class="section-card">
      <div class="section-body">
        <div class="alert alert-danger">⚠️ ${r.message || '计算异常'}</div>
      </div>
    </div>`;
}

// ---- 结果渲染 ----
function renderKeywayResults(r) {
  const container = document.getElementById('results-keyway');
  const g = r.keyGeometry;
  const ld = r.loadInfo;
  const s = r.strength;

  function statusClass(st) {
    if (st === '合格') return 'status-qualified';
    if (st === '警告') return 'status-warning';
    if (st === 'N/A') return '';
    return 'status-fail';
  }

  function sfDisplay(val) {
    if (val === null || val === undefined) return '—';
    return 'n = ' + val;
  }

  let html = '';

  // ====== Card 1: 键几何参数 ======
  html += `
  <div class="section-card">
    <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      🔑 键几何参数 — b×h=${g.b}×${g.h} mm · L=${g.L} mm · ${r.input.keyTypeName}
      <span style="font-size:0.75rem;color:var(--text-light)">▼</span>
    </div>
    <div class="section-body">
      <div class="key-profile">
        <svg viewBox="0 0 440 200" width="420" height="200" xmlns="http://www.w3.org/2000/svg">
          <!-- 轴截面 -->
          <rect x="10" y="40" width="200" height="120" rx="100" fill="#e8ecf2" stroke="#6b7c93" stroke-width="1.5"/>
          <!-- 键 -->
          <rect x="95" y="10" width="${Math.min(g.b * 3, 40)}" height="40" rx="2" fill="#fdebd0" stroke="#e67e22" stroke-width="2"/>
          <!-- 键宽标注 -->
          <line x1="95" y1="60" x2="95" y2="80" stroke="#e67e22" stroke-width="1" marker-end="url(#arrowDown)"/>
          <line x1="${95 + Math.min(g.b * 3, 40)}" y1="60" x2="${95 + Math.min(g.b * 3, 40)}" y2="80" stroke="#e67e22" stroke-width="1"/>
          <text x="${95 + Math.min(g.b * 3, 40) / 2}" y="78" text-anchor="middle" font-size="10" fill="#e67e22">b=${g.b}</text>
          <!-- 键高标注 -->
          <line x1="150" y1="10" x2="150" y2="-5" stroke="#e67e22" stroke-width="1"/>
          <text x="155" y="8" font-size="10" fill="#e67e22">h=${g.h}</text>
          <!-- 轴径标注 -->
          <line x1="10" y1="100" x2="10" y2="40" stroke="#6b7c93" stroke-width="1"/>
          <line x1="210" y1="100" x2="210" y2="40" stroke="#6b7c93" stroke-width="1"/>
          <text x="110" y="165" text-anchor="middle" font-size="10" fill="#6b7c93">d=${r.input.shaftDiameter} mm</text>
          <!-- t1 标注 -->
          <rect x="240" y="12" width="180" height="80" rx="6" fill="#f5f6f8" stroke="#6b7c93" stroke-width="1"/>
          <text x="330" y="32" text-anchor="middle" font-size="9" fill="#6b7c93">键截面放大</text>
          <rect x="290" y="40" width="80" height="${Math.min(g.h * 3, 30)}" fill="#fdebd0" stroke="#e67e22" stroke-width="2"/>
          <!-- t1 -->
          <rect x="290" y="${40 + Math.min(g.h * 3, 30)}" width="80" height="${Math.min(g.t1 * 3, 20)}" fill="#d5e8f5" stroke="#2980b9" stroke-width="1"/>
          <text x="380" y="${46 + Math.min(g.t1 * 3, 20) + Math.min(g.h * 3, 30) / 2}" font-size="8" fill="#2980b9">t₁=${g.t1}</text>
          <!-- k -->
          <text x="380" y="52" font-size="8" fill="#e67e22">k=${g.contactHeight_k}</text>
        </svg>
      </div>

      <table class="param-table">
        <tr><td>轴径范围</td><td>${g.dRange} mm</td></tr>
        <tr><td>键宽 × 键高</td><td><strong>b × h = ${g.b} × ${g.h} mm</strong></td></tr>
        <tr><td>轴上键槽深 t₁</td><td>${g.t1} mm</td></tr>
        <tr><td>毂上键槽深 t₂</td><td>${g.t2} mm</td></tr>
        <tr><td>接触高度 k = h − t₁</td><td>${g.contactHeight_k} mm（键与轮毂接触部分）</td></tr>
        <tr><td>键全长 L</td><td>${g.L} mm（${r.input.lengthSource}）</td></tr>
        <tr><td>工作长度 l_work</td><td><strong>${g.l_work} mm</strong></td></tr>
        <tr><td>键长/轴径比</td><td>${g.lengthRatio} — ${g.lengthAdvice || ''}</td></tr>
        ${g.L < g.Lmin || g.L > g.Lmax ? `<tr><td colspan="2"><div class="alert alert-warning">⚠️ 键长超出推荐范围 ${g.Lmin}~${g.Lmax} mm</div></td></tr>` : ''}
      </table>
    </div>
  </div>`;

  // ====== Card 2: 载荷与许用值 ======
  html += `
  <div class="section-card">
    <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      📊 载荷与许用应力
      <span style="font-size:0.75rem;color:var(--text-light)">▼</span>
    </div>
    <div class="section-body">
      <div class="info-row"><span class="label">载荷类型</span><span class="value">${ld.loadType}</span><span style="font-size:0.78rem;color:var(--text-light)">${ld.loadDescription}</span></div>
      <div class="info-row"><span class="label">轮毂材料</span><span class="value">${ld.hubMaterial}</span><span style="font-size:0.78rem;color:var(--text-light)">${ld.hubMaterialHint}</span></div>
      <div class="info-row"><span class="label">键材料</span><span class="value">${ld.keyMaterial}</span></div>
      <hr class="section-divider">
      <table class="param-table">
        <tr><td>许用剪切应力 [τ]</td><td><strong>${ld.allowableShearStress_tau} MPa</strong> (范围: ${ld.allowableShearStress_range} MPa)</td></tr>
        <tr><td>许用挤压应力 [σ<sub>p</sub>]</td><td><strong>${ld.allowableCrushingStress_sigma_p} MPa</strong> (范围: ${ld.allowableCrushingStress_range} MPa)</td></tr>
      </table>
    </div>
  </div>`;

  // ====== Card 3: 强度校核结果 ======
  if (s) {
    html += `
    <div class="section-card">
      <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
        🛡️ 强度校核结果 — T = ${s.torque_Nm} N·m
        <span style="font-size:0.75rem;color:var(--text-light)">▼</span>
      </div>
      <div class="section-body">
        <div style="font-size:0.75rem;color:var(--text-light);margin-bottom:8px">${s.torqueSource}</div>
        <table class="param-table">
          <tr><th style="width:20%">校核项目</th><th style="width:28%">应力值</th><th style="width:18%">安全系数</th><th style="width:34%">判定</th></tr>
          <tr>
            <td>① 键剪切 τ</td>
            <td style="font-family:var(--font-mono)">τ = ${s.shear.stress_MPa} MPa</td>
            <td style="font-family:var(--font-mono)">${sfDisplay(s.shear.safetyFactor)}</td>
            <td><span class="status-badge ${statusClass(s.shear.status)}">${s.shear.status} ≥${s.shear.threshold.qualified}</span></td>
          </tr>
          <tr>
            <td>② 毂挤压 σ<sub>p</sub></td>
            <td style="font-family:var(--font-mono)">σ<sub>p</sub> = ${s.hubCrushing.stress_MPa} MPa</td>
            <td style="font-family:var(--font-mono)">${sfDisplay(s.hubCrushing.safetyFactor)}</td>
            <td><span class="status-badge ${statusClass(s.hubCrushing.status)}">${s.hubCrushing.status} ≥${s.hubCrushing.threshold.qualified}</span></td>
          </tr>
          <tr>
            <td>③ 轴挤压 σ<sub>p</sub></td>
            <td style="font-family:var(--font-mono)">σ<sub>p</sub> = ${s.shaftCrushing.stress_MPa} MPa</td>
            <td style="font-family:var(--font-mono)">${sfDisplay(s.shaftCrushing.safetyFactor)}</td>
            <td>
              <span class="status-badge ${statusClass(s.shaftCrushing.status)}">${s.shaftCrushing.status} ≥${s.shaftCrushing.threshold.qualified}</span>
              <div style="font-size:0.7rem;color:var(--text-light);margin-top:2px">${s.shaftCrushing.note}</div>
            </td>
          </tr>
        </table>

        ${s.shear.status === '不合格' ? `<div class="alert alert-danger" style="margin-top:8px">⚠️ 剪切强度不合格！键有剪断风险。建议：增大键长/键宽，或改用双键/花键联接。</div>` : ''}
        ${s.hubCrushing.status === '不合格' ? `<div class="alert alert-danger" style="margin-top:8px">⚠️ 轮毂挤压强度不合格！键槽侧面有压溃风险。建议：增大键长，改用高强度轮毂材料，或改用双键。</div>` : ''}
        ${s.shear.status !== '不合格' && s.hubCrushing.status !== '不合格' ? `<div class="alert alert-success" style="margin-top:8px">✅ 所有校核项均满足安全系数要求，平键联接强度合格。</div>` : ''}

        <div class="alert alert-info" style="margin-top:8px;font-size:0.78rem">
          📐 设计参考：键长 L 宜取轴径的 1.2~2.0 倍。若单键承载不足，可考虑：
          双键（180°布置，承载能力1.5倍） | 花键联接（承载能力3~5倍） | 加大轴径
        </div>
      </div>
    </div>`;
  } else {
    html += `
    <div class="section-card">
      <div class="section-body">
        <div class="alert alert-info">📋 请输入转矩或（功率+转速）以执行强度校核</div>
      </div>
    </div>`;
  }

  // ====== Card 4: 计算详情 ======
  html += `
  <div class="section-card collapsed">
    <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      📝 中间计算详情（供人工验算）
      <span style="font-size:0.75rem;color:var(--text-light)">▶ 点击展开</span>
    </div>
    <div class="section-body" style="font-size:0.8rem">
      <div class="formula-block">
        <span class="formula-label">① 标准键截面查询（GB/T 1096-2003）</span>
        轴径 d = ${r.input.shaftDiameter} mm → ${g.dRange}<br>
        → 键宽 b = <strong>${g.b} mm</strong>, 键高 h = <strong>${g.h} mm</strong>, t₁ = ${g.t1} mm, t₂ = ${g.t2} mm
      </div>
      <div class="formula-block">
        <span class="formula-label">② 工作长度计算</span>
        ${r.input.keyTypeName}: l_work = L - ${r.input.keyType === 'B' ? '0' : (r.input.keyType === 'C' ? 'b/2' : 'b')}
        = ${g.L} - ${r.input.keyType === 'C' ? g.b + '/2' : (r.input.keyType === 'B' ? '0' : g.b)}
        = <strong>${g.l_work} mm</strong>
      </div>
      ${s ? `
      <div class="formula-block">
        <span class="formula-label">③ 键剪切强度</span>
        F<sub>t</sub> = 2T/d = 2×${s.torque_Nm}×1000 / ${r.input.shaftDiameter} = ${s.shear.F_t_N.toFixed(0)} N<br>
        τ = F<sub>t</sub> / (b·l_work) = ${s.shear.F_t_N.toFixed(0)} / (${g.b}×${g.l_work})
        = <strong>${s.shear.stress_MPa} MPa</strong>
        &nbsp;|&nbsp; [τ] = ${s.shear.allowable_MPa} MPa
        &nbsp;|&nbsp; n<sub>τ</sub> = ${s.shear.safetyFactor}
      </div>
      <div class="formula-block">
        <span class="formula-label">④ 轮毂键槽挤压强度</span>
        k = h − t₁ = ${g.h} − ${g.t1} = ${s.hubCrushing.k_mm} mm<br>
        σ<sub>p</sub> = F<sub>t</sub> / (k·l_work) = ${s.shear.F_t_N.toFixed(0)} / (${s.hubCrushing.k_mm}×${g.l_work})
        = <strong>${s.hubCrushing.stress_MPa} MPa</strong>
        &nbsp;|&nbsp; [σ<sub>p</sub>] = ${s.hubCrushing.allowable_MPa} MPa
        &nbsp;|&nbsp; n<sub>p</sub> = ${s.hubCrushing.safetyFactor}
      </div>
      <div class="formula-block">
        <span class="formula-label">⑤ 轴键槽挤压强度</span>
        σ<sub>p</sub> = F<sub>t</sub> / (t₁·l_work) = ${s.shear.F_t_N.toFixed(0)} / (${g.t1}×${g.l_work})
        = <strong>${s.shaftCrushing.stress_MPa} MPa</strong>
        &nbsp;|&nbsp; [σ<sub>p</sub>] = ${s.shaftCrushing.allowable_MPa} MPa
        &nbsp;|&nbsp; n<sub>p</sub> = ${s.shaftCrushing.safetyFactor}
        &nbsp;|&nbsp; ${s.shaftCrushing.note}
      </div>` : ''}
      ${s ? `
      <div class="formula-block">
        <span class="formula-label">⑥ 许用应力取值依据（《机械设计手册》第五版 表6-2-12）</span>
        载荷: ${s.loadType} — ${s.loadDescription}<br>
        轮毂: ${s.hubMaterial} — ${s.hubMaterialDescription}<br>
        [τ]范围 = ${s.allowable.shear_tau_range} MPa → 取 <strong>${s.allowable.shear_tau} MPa</strong><br>
        [σ<sub>p</sub>]范围 = ${s.allowable.crushing_sigma_p_range} MPa → 取 <strong>${s.allowable.crushing_sigma_p} MPa</strong>
      </div>` : ''}
    </div>
  </div>`;

  container.innerHTML = html;
}

// ---- 重置 ----
function resetKeyway() {
  document.getElementById('key-input-d').value = '50';
  document.getElementById('key-input-type').value = 'A';
  document.getElementById('key-input-length').value = '0';
  document.getElementById('key-input-load').value = 'static';
  document.getElementById('key-input-hub').value = 'steel';
  document.getElementById('key-input-keymat').value = '45钢';
  document.getElementById('key-input-torque').value = '0';
  document.getElementById('key-input-power').value = '0';
  document.getElementById('key-input-speed').value = '0';
  document.getElementById('key-dim-hint').className = 'alert alert-info';
  document.getElementById('key-dim-hint').innerHTML = '📐 输入轴径后自动查询标准键截面尺寸';
  document.getElementById('key-input-length').placeholder = '0=自动推荐';
  // 隐藏自定义材料面板
  var ckHub = document.getElementById('custom-key-hub');
  var ckMat = document.getElementById('custom-key-mat');
  if (ckHub) ckHub.style.display = 'none';
  if (ckMat) ckMat.style.display = 'none';
  document.getElementById('results-keyway').innerHTML = `
    <div class="empty-state" id="empty-state-keyway">
      <div class="icon">🔑</div>
      <p>输入轴径和转矩后点击 <strong>"开始校核"</strong></p>
      <p style="font-size:0.8rem;margin-top:4px">键截面尺寸按 GB/T 1096-2003 自动查询</p>
    </div>`;
}
