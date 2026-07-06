// ================================================================
// Tab 1: 渐开线花键 — UI 桥接函数
// 所有计算均调用 calc.js 暴露的函数
// 禁止在页面内编写任何计算公式
// ================================================================

// ---- 初始化 ----
function initSpline() {
  const selectM = document.getElementById('input-m');
  MODULE_SERIES.priority1.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = `m = ${m}`;
    selectM.appendChild(opt);
  });
  selectM.value = '2';

  document.getElementById('input-m').addEventListener('change', updatePinSuggestion);
  updatePinSuggestion();
}

function updatePinSuggestion() {
  const m = parseFloat(document.getElementById('input-m').value) || 2;
  const rec = getRecommendedPinDiameter(m);
  const pinInput = document.getElementById('input-pin');
  if (parseFloat(pinInput.value) <= 0) {
    pinInput.placeholder = `推荐: ${rec.recommended} (理论 ${rec.theoretical})`;
  }
}

// ---- 加载示例 ----
function loadSplineExample(type) {
  switch(type) {
    case 'motor':
      document.getElementById('input-m').value = '2';
      document.getElementById('input-z').value = '25';
      document.getElementById('input-grade').value = '6';
      document.getElementById('input-fit').value = 'H/h';
      document.getElementById('input-root').value = 'flatRoot';
      document.getElementById('input-pin').value = '0';
      document.getElementById('input-length').value = '50';
      document.getElementById('input-torque').value = '500';
      document.getElementById('input-power').value = '75';
      document.getElementById('input-speed').value = '1500';
      document.getElementById('input-material').value = '40Cr调质';
      document.getElementById('input-moment').value = '0';
      break;
    case 'small':
      document.getElementById('input-m').value = '0.75';
      document.getElementById('input-z').value = '32';
      document.getElementById('input-grade').value = '5';
      document.getElementById('input-fit').value = 'H/f';
      document.getElementById('input-root').value = 'flatRoot';
      document.getElementById('input-pin').value = '0';
      document.getElementById('input-length').value = '20';
      document.getElementById('input-torque').value = '50';
      document.getElementById('input-power').value = '15';
      document.getElementById('input-speed').value = '3000';
      document.getElementById('input-material').value = '20CrMnTi渗碳淬火';
      document.getElementById('input-moment').value = '0';
      break;
    case 'large':
      document.getElementById('input-m').value = '5';
      document.getElementById('input-z').value = '20';
      document.getElementById('input-grade').value = '7';
      document.getElementById('input-fit').value = 'H/e';
      document.getElementById('input-root').value = 'filletRoot';
      document.getElementById('input-pin').value = '0';
      document.getElementById('input-length').value = '80';
      document.getElementById('input-torque').value = '5000';
      document.getElementById('input-power').value = '200';
      document.getElementById('input-speed').value = '400';
      document.getElementById('input-material').value = '42CrMo调质';
      document.getElementById('input-moment').value = '0';
      break;
  }
  updatePinSuggestion();
  calcSpline();
}

// ---- 主计算函数 ----
function calcSpline() {
  const m = parseFloat(document.getElementById('input-m').value);
  const z = parseInt(document.getElementById('input-z').value);
  const grade = parseInt(document.getElementById('input-grade').value);
  const fit = document.getElementById('input-fit').value;
  const root = document.getElementById('input-root').value;
  const pin = parseFloat(document.getElementById('input-pin').value) || 0;
  const length = parseFloat(document.getElementById('input-length').value) || 0;
  const torque = parseFloat(document.getElementById('input-torque').value) || 0;
  const power = parseFloat(document.getElementById('input-power').value) || 0;
  const speed = parseFloat(document.getElementById('input-speed').value) || 0;
  const material = document.getElementById('input-material').value;
  const moment = parseFloat(document.getElementById('input-moment').value) || 0;

  if (!m || m <= 0) { alert('请选择有效的模数 m'); return; }
  if (!z || z < 6 || z > 120) { alert('齿数 z 应在 6~120 之间'); return; }

  // 处理自定义材料
  let customMaterial = null;
  if (material === 'custom') {
    customMaterial = {
      allowableCompression: readCustomVal('cs-compression'),
      allowableShear: readCustomVal('cs-shear'),
      allowableBending: readCustomVal('cs-bending'),
      allowableWearPV: readCustomVal('cs-wearPV'),
      allowableWearFreeContact: readCustomVal('cs-wearFree'),
      hardness: document.getElementById('cs-hardness').value || '自定义'
    };
  }

  let result;
  try {
    result = calcAll({ m, z, toleranceGrade: grade, fitType: fit,
                       rootType: root, pinDiameter: pin,
                       engagementLength: length, torque: torque,
                       power_kW: power, speed_rpm: speed,
                       material: material, bendingMoment: moment,
                       industry: 'general', customMaterial: customMaterial });
  } catch (e) {
    alert('计算出错: ' + e.message);
    console.error(e);
    return;
  }

  renderSplineResults(result);
  document.getElementById('results-spline').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- 结果渲染 ----
function renderSplineResults(r) {
  const container = document.getElementById('results-spline');
  const ext = r.external;
  const int = r.internal;
  const tol = r.tolerance;
  const fit = r.fit;

  function statusClass(s) {
    if (s === '合格' || s === '无磨损 ✓') return 'status-qualified';
    if (s === '警告' || s === '可能磨损 ⚠') return 'status-warning';
    if (s && s.startsWith('未校核')) return '';
    return 'status-fail';
  }

  function fmtDia(val, tol) {
    return `φ${val} (${tol})`;
  }
  function fmtRange(hi, lo) {
    return `${hi} / ${lo}`;
  }

  let html = '';

  // ====== Card 1: 基本参数 + 配合 ======
  html += `
  <div class="section-card">
    <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      📐 基本参数 — m=${r.input.m}, z=${r.input.z}, ${r.input.rootType}, ${tol.公差等级}级 ${fit.配合类别}
      <span style="font-size:0.75rem;color:var(--text-light)">▼</span>
    </div>
    <div class="section-body">
      <table class="param-table">
        <tr><td>分度圆直径 D</td><td>φ${r.basic.分度圆直径_D} mm</td></tr>
        <tr><td>基圆直径 D<sub>b</sub></td><td>φ${r.basic.基圆直径_Db} mm</td></tr>
        <tr><td>齿距 p</td><td>${r.basic.齿距_p} mm</td></tr>
        <tr><td>基本齿厚/齿槽宽 S / E</td><td>${r.basic.基本齿厚_S} mm</td></tr>
        <tr><td>配合</td><td>${fit.配合类别} — ${fit.配合性质}（${fit.配合说明}）</td></tr>
        <tr><td>侧隙范围</td><td>${fit.最小侧隙_mm} ~ ${fit.最大侧隙_mm} mm</td></tr>
        ${fit.最小侧隙_mm <= 0 ? `<tr><td colspan="2"><div class="alert alert-warning">⚠️ 最小侧隙 ≤ 0，该配合可能为过渡/过盈配合</div></td></tr>` : ''}
      </table>
    </div>
  </div>`;

  // ====== Card 2: 外花键（轴） ======
  html += `
  <div class="section-card">
    <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      🔧 外花键（轴）
      <span style="font-size:0.75rem;color:var(--text-light)">▼</span>
    </div>
    <div class="section-body">
      <table class="param-table">
        <tr><td>大径 D<sub>ee</sub></td><td>${fmtDia(ext.大径_D_ee.basic, ext.大径_D_ee.标注)}</td></tr>
        <tr><td>小径 D<sub>ie</sub></td><td>${fmtDia(ext.小径_D_ie.basic, ext.小径_D_ie.标注)}</td></tr>
        <tr><td>渐开线起始圆 D<sub>Fe min</sub></td><td>φ${ext.渐开线起始圆_D_Fe_min} mm</td></tr>
        <tr><td>齿厚 S</td><td>${fmtRange(ext.齿厚.actual_max, ext.齿厚.actual_min)} (es<sub>v</sub>=${ext.齿厚.es_v_um}μm, T=${ext.齿厚.tolerance_T}mm)</td></tr>
        <tr><td>跨棒距 M<sub>Re</sub></td>
          <td>D<sub>R</sub>=${ext.跨棒距_M_Re.pinDiameter} → ${ext.跨棒距_M_Re.max} / ${ext.跨棒距_M_Re.min}</td></tr>
        ${ext.跨棒距_M_Re.max_detail.error ? `<tr><td colspan="2"><div class="alert alert-warning">⚠️ ${ext.跨棒距_M_Re.max_detail.message}</div></td></tr>` : ''}
      </table>
    </div>
  </div>`;

  // ====== Card 3: 内花键（毂） ======
  html += `
  <div class="section-card">
    <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      🔩 内花键（毂）
      <span style="font-size:0.75rem;color:var(--text-light)">▼</span>
    </div>
    <div class="section-body">
      <table class="param-table">
        <tr><td>大径 D<sub>ei</sub></td><td>${fmtDia(int.大径_D_ei.basic, int.大径_D_ei.标注)}</td></tr>
        <tr><td>小径 D<sub>ii</sub></td><td>${fmtDia(int.小径_D_ii.basic, int.小径_D_ii.标注)}</td></tr>
        <tr><td>渐开线终止圆 D<sub>Fi max</sub></td><td>φ${int.渐开线终止圆_D_Fi_max} mm</td></tr>
        <tr><td>齿槽宽 E</td><td>${fmtRange(int.齿槽宽.actual_max, int.齿槽宽.actual_min)} (EI=0, T=${int.齿槽宽.tolerance_T}mm)</td></tr>
        <tr><td>棒间距 M<sub>Ri</sub></td>
          <td>D<sub>R</sub>=${int.棒间距_M_Ri.pinDiameter} → ${int.棒间距_M_Ri.min} / ${int.棒间距_M_Ri.max}</td></tr>
        ${int.棒间距_M_Ri.min_detail.error ? `<tr><td colspan="2"><div class="alert alert-warning">⚠️ ${int.棒间距_M_Ri.min_detail.message}</div></td></tr>` : ''}
      </table>
    </div>
  </div>`;

  // ====== Card 4: 公差明细 ======
  html += `
  <div class="section-card">
    <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      📏 公差明细 — ${tol.公差等级}级 · ${tol.等级说明} · L=${tol.配合长度_L_mm}mm
      <span style="font-size:0.75rem;color:var(--text-light)">▼</span>
    </div>
    <div class="section-body">
      <table class="param-table">
        <tr><th>项目</th><th>符号</th><th>值 (μm)</th><th>计算式</th></tr>
        <tr><td>总公差</td><td>T+λ</td><td>${tol.总公差_T_lambda_um}</td>
          <td style="font-size:0.72rem">K₁·i*(D)+K₂·i**(S)</td></tr>
        <tr><td>综合公差</td><td>λ</td><td>${tol.综合公差_lambda_um}</td>
          <td style="font-size:0.72rem">0.6√(Fp²+ff²+Fβ²)</td></tr>
        <tr><td>加工公差</td><td>T</td><td>${tol.加工公差_T_um}</td>
          <td style="font-size:0.72rem">(T+λ)−λ</td></tr>
        <tr style="background:#fafbfc"><td>齿距累积</td><td>F<sub>p</sub></td><td>${tol.齿距累积公差_Fp_um}</td><td></td></tr>
        <tr style="background:#fafbfc"><td>齿形公差</td><td>f<sub>f</sub></td><td>${tol.齿形公差_ff_um}</td><td></td></tr>
        <tr style="background:#fafbfc"><td>齿向公差</td><td>F<sub>β</sub></td><td>${tol.齿向公差_Fbeta_um}</td><td></td></tr>
      </table>
    </div>
  </div>`;

  // ====== Card 5: 强度校核 ======
  if (r.strength) {
    const s = r.strength;
    function strengthRow(label, symbol, value, unit, sf, threshold, status) {
      return `<tr>
        <td>${label}</td>
        <td style="font-family:var(--font-mono)">${symbol} = ${value} ${unit}</td>
        <td style="font-family:var(--font-mono)">n = ${sf}</td>
        <td><span class="status-badge ${statusClass(status)}">${status}${threshold ? ' ≥'+threshold : ''}</span></td>
      </tr>`;
    }

    html += `
    <div class="section-card">
      <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
        🛡️ 强度校核 — ${s.material} (${s.materialHardness}) · T = ${s.torque} N·m · <span style="font-size:0.72rem;color:var(--text-light)">《机械设计手册》第五版</span>
        <span style="font-size:0.75rem;color:var(--text-light)">▼</span>
      </div>
      <div class="section-body">
        <div style="font-size:0.75rem;color:var(--text-light);margin-bottom:8px">${s.torqueSource}</div>
        <table class="param-table">
          <tr><th style="width:18%">校核项目</th><th style="width:32%">应力/值</th><th style="width:18%">安全系数</th><th style="width:32%">判定</th></tr>
          ${strengthRow('① 齿面接触', 'σ<sub>H</sub>', s.contact.stress_MPa, 'MPa',
            s.contact.safetyFactor, s.contact.threshold.qualified, s.contact.status)}
          ${strengthRow('② 齿根弯曲', 'σ<sub>F</sub>', s.bending.stress_MPa, 'MPa',
            s.bending.safetyFactor, s.bending.threshold.qualified, s.bending.status)}
          ${strengthRow('③ 齿根抗剪', 'τ', s.shear.stress_MPa, 'MPa',
            s.shear.safetyFactor, s.shear.threshold.qualified, s.shear.status)}
          ${s.wear10e8 ? strengthRow('④ 10⁸循环磨损', 'p·v', s.wear10e8.pv_MPa_ms, 'MPa·m/s',
            s.wear10e8.safetyFactor, '1.5', s.wear10e8.status) : ''}
          <tr>
            <td>⑤ 长期无磨损</td>
            <td style="font-family:var(--font-mono)">σ<sub>H</sub>=${s.wearFree.sigma_H_MPa} ≤ [σ<sub>Hw</sub>]=${s.wearFree.allowable_MPa} MPa</td>
            <td style="font-family:var(--font-mono)">m = ${s.wearFree.margin}</td>
            <td><span class="status-badge ${s.wearFree.isWearFree ? 'status-qualified' : 'status-warning'}">${s.wearFree.isWearFree ? '无磨损 ✓' : '可能磨损 ⚠'}</span></td>
          </tr>
          ${strengthRow('⑥ 轴扭转', 'τ<sub>max</sub>', s.shaftTorsion.stress_MPa, 'MPa',
            s.shaftTorsion.safetyFactor, s.shaftTorsion.threshold || s.bending.threshold.qualified, s.shaftTorsion.status)}
          <tr>
            <td>⑦ 轴弯曲</td>
            <td style="font-family:var(--font-mono)">${s.shaftBending.sigma_e_MPa > 0
              ? `σ<sub>e</sub>=${s.shaftBending.sigma_e_MPa} MPa (M=${s.shaftBending.bendingMoment_Nm} N·m)`
              : '—（未提供弯矩）'}</td>
            <td style="font-family:var(--font-mono)">${s.shaftBending.safetyFactor || '—'}</td>
            <td><span class="status-badge ${statusClass(s.shaftBending.status)}">${s.shaftBending.status}</span></td>
          </tr>
        </table>
        ${s.wear10e8 ? `
        <div class="alert alert-info" style="margin-top:8px">
          📐 磨损计算细节：滑动速度 v<sub>s</sub> = ${s.wear10e8.v_s_ms} m/s，
          10⁸循环总滑动距离 ≈ ${s.wear10e8.totalSlidingDistance_m} m，
          许用 [p·v] = ${s.wear10e8.allowable_MPa_ms} MPa·m/s
        </div>` : ''}
        ${s.wearFree.isWearFree ? '' : `
        <div class="alert alert-warning" style="margin-top:8px">
          ⚠️ 接触应力超过无磨损门槛值，长期工作可能发生微动磨损。建议改善润滑条件或选用更高硬度材料。
        </div>`}
      </div>
    </div>`;
  }

  // ====== Card 6: 中间计算详情 ======
  html += `
  <div class="section-card collapsed">
    <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      📝 中间计算详情（供人工验算）
      <span style="font-size:0.75rem;color:var(--text-light)">▶ 点击展开</span>
    </div>
    <div class="section-body" style="font-size:0.8rem">
      <div class="formula-block">
        <span class="formula-label">① 分度圆直径 D = m × z</span>
        = ${r.input.m} × ${r.input.z} = <strong>${r.basic.分度圆直径_D} mm</strong>
      </div>
      <div class="formula-block">
        <span class="formula-label">② 基圆直径 D<sub>b</sub> = D × cos30°</span>
        = ${r.basic.分度圆直径_D} × 0.8660254 = <strong>${r.basic.基圆直径_Db} mm</strong>
      </div>
      <div class="formula-block">
        <span class="formula-label">③ 齿距 p = πm，基本齿厚 S = p/2</span>
        p = π × ${r.input.m} = ${r.basic.齿距_p} mm，S = E = <strong>${r.basic.基本齿厚_S} mm</strong>
      </div>
      <div class="formula-block">
        <span class="formula-label">④ 公差单位</span>
        i*(D) = 0.45∛D + 0.001D &nbsp;|&nbsp; i**(S) = 0.45∛S + 0.001S<br>
        总公差 (T+λ) = K₁·i* + K₂·i** = <strong>${tol.总公差_T_lambda_um} μm</strong>
      </div>
      <div class="formula-block">
        <span class="formula-label">⑤ 综合公差 λ = 0.6√(Fp² + ff² + Fβ²)</span>
        = 0.6 × √(${tol.齿距累积公差_Fp_um}² + ${tol.齿形公差_ff_um}² + ${tol.齿向公差_Fbeta_um}²) = <strong>${tol.综合公差_lambda_um} μm</strong>
      </div>
      <div class="formula-block">
        <span class="formula-label">⑥ 外花键齿厚 S</span>
        S<sub>max</sub> = S + es<sub>v</sub>/1000 − λ/1000 = ${r.basic.基本齿厚_S} + ${ext.齿厚.es_v_um}/1000 − ${tol.综合公差_lambda_um}/1000 = <strong>${ext.齿厚.actual_max} mm</strong><br>
        S<sub>min</sub> = S + es<sub>v</sub>/1000 − (T+λ)/1000 = <strong>${ext.齿厚.actual_min} mm</strong>
      </div>
      <div class="formula-block">
        <span class="formula-label">⑦ 内花键齿槽宽 E（基孔制 H，EI=0）</span>
        E<sub>min</sub> = E + λ/1000 = ${r.basic.基本齿厚_S} + ${tol.综合公差_lambda_um}/1000 = <strong>${int.齿槽宽.actual_min} mm</strong><br>
        E<sub>max</sub> = E + (T+λ)/1000 = <strong>${int.齿槽宽.actual_max} mm</strong>
      </div>
      <div class="formula-block">
        <span class="formula-label">⑧ 外花键跨棒距 M<sub>Re</sub></span>
        inv(α<sub>e</sub>) = S/D + inv30° + D<sub>R</sub>/D<sub>b</sub> − π/z<br>
        α<sub>e</sub> 由牛顿迭代求解 → M<sub>Re</sub> = D<sub>b</sub>/cos(α<sub>e</sub>) + D<sub>R</sub> (偶齿) 或 + D<sub>R</sub> × cos(90°/z) 修正 (奇齿)
      </div>
      <div class="formula-block">
        <span class="formula-label">⑨ 内花键棒间距 M<sub>Ri</sub></span>
        inv(α<sub>i</sub>) = E/D + inv30° − D<sub>R</sub>/D<sub>b</sub><br>
        α<sub>i</sub> 由牛顿迭代求解 → M<sub>Ri</sub> = D<sub>b</sub>/cos(α<sub>i</sub>) − D<sub>R</sub> (偶齿) 或 − D<sub>R</sub> × cos(90°/z) 修正 (奇齿)
      </div>
      ${r.strength ? `
      <div class="formula-block">
        <span class="formula-label">⑩ 齿面接触强度（《机械设计手册》第五版）</span>
        σ<sub>H</sub> = 2000T / (ψ·z·h<sub>c</sub>·l·D<sub>m</sub>) = <strong>${r.strength.contact.stress_MPa} MPa</strong>
        &nbsp;|&nbsp; 许用 [σ<sub>H</sub>] = ${r.strength.contact.allowable_MPa} MPa
        &nbsp;|&nbsp; n<sub>H</sub> = ${r.strength.contact.safetyFactor}
      </div>
      <div class="formula-block">
        <span class="formula-label">⑪ 齿根弯曲强度（《机械设计手册》第五版）</span>
        σ<sub>F</sub> = 6000T·h / (ψ·z·S<sub>fn</sub>²·l·D<sub>m</sub>) = <strong>${r.strength.bending.stress_MPa} MPa</strong>
        &nbsp;|&nbsp; 许用 [σ<sub>F</sub>] = ${r.strength.bending.allowable_MPa} MPa
        &nbsp;|&nbsp; n<sub>F</sub> = ${r.strength.bending.safetyFactor}
      </div>
      <div class="formula-block">
        <span class="formula-label">⑫ 齿根抗剪强度（《机械设计手册》第五版）</span>
        τ = 2000T / (ψ·z·S<sub>fn</sub>·l·D<sub>m</sub>) = <strong>${r.strength.shear.stress_MPa} MPa</strong>
        &nbsp;|&nbsp; 许用 [τ] = ${r.strength.shear.allowable_MPa} MPa
        &nbsp;|&nbsp; n<sub>τ</sub> = ${r.strength.shear.safetyFactor}
      </div>
      ${r.strength.wear10e8 ? `
      <div class="formula-block">
        <span class="formula-label">⑬ 10⁸循环磨损校核（p·v 值法）</span>
        v<sub>s</sub> = π·h<sub>c</sub>·n / 60000 = <strong>${r.strength.wear10e8.v_s_ms} m/s</strong><br>
        p·v = σ<sub>H</sub> × v<sub>s</sub> = <strong>${r.strength.wear10e8.pv_MPa_ms} MPa·m/s</strong>
        &nbsp;|&nbsp; 许用 [p·v] = ${r.strength.wear10e8.allowable_MPa_ms} MPa·m/s
        &nbsp;|&nbsp; n<sub>pv</sub> = ${r.strength.wear10e8.safetyFactor}
      </div>` : ''}
      <div class="formula-block">
        <span class="formula-label">⑭ 长期工作无磨损校核</span>
        σ<sub>H</sub> = ${r.strength.wearFree.sigma_H_MPa} MPa
        ${r.strength.wearFree.isWearFree ? '≤' : '>'}
        [σ<sub>Hw</sub>] = ${r.strength.wearFree.allowable_MPa} MPa
        &nbsp;|&nbsp; 裕度 m = ${r.strength.wearFree.margin}
        &nbsp;→&nbsp; <strong>${r.strength.wearFree.isWearFree ? '长期无磨损' : '可能发生微动磨损'}</strong>
      </div>
      <div class="formula-block">
        <span class="formula-label">⑮ 外花键轴扭转强度（《机械设计手册》第五版）</span>
        τ<sub>max</sub> = 16000T / (π·D<sub>ie_min</sub>³) = <strong>${r.strength.shaftTorsion.stress_MPa} MPa</strong>
        &nbsp;|&nbsp; W<sub>t</sub> = ${r.strength.shaftTorsion.W_t_mm3} mm³
        &nbsp;|&nbsp; d = ${r.strength.shaftTorsion.D_ie_min} mm
        &nbsp;|&nbsp; n<sub>τ</sub> = ${r.strength.shaftTorsion.safetyFactor}
      </div>
      <div class="formula-block">
        <span class="formula-label">⑯ 外花键轴弯曲强度（《机械设计手册》第五版）</span>
        ${r.strength.shaftBending.sigma_e_MPa > 0
          ? `σ<sub>e</sub> = √(σ<sub>b</sub>² + 3τ²) = <strong>${r.strength.shaftBending.sigma_e_MPa} MPa</strong>
          &nbsp;|&nbsp; W<sub>b</sub> = ${r.strength.shaftBending.W_b_mm3} mm³
          &nbsp;|&nbsp; M = ${r.strength.shaftBending.bendingMoment_Nm} N·m`
          : `未提供弯矩值，跳过弯扭合成校核。W<sub>b</sub> = ${r.strength.shaftBending.W_b_mm3} mm³（供参考）`}
      </div>` : ''}
    </div>
  </div>`;

  container.innerHTML = html;
}

// ---- 重置 ----
function resetSpline() {
  document.getElementById('input-m').value = '2';
  document.getElementById('input-z').value = '25';
  document.getElementById('input-grade').value = '6';
  document.getElementById('input-fit').value = 'H/h';
  document.getElementById('input-root').value = 'flatRoot';
  document.getElementById('input-pin').value = '0';
  document.getElementById('input-length').value = '0';
  document.getElementById('input-torque').value = '0';
  document.getElementById('input-power').value = '0';
  document.getElementById('input-speed').value = '0';
  document.getElementById('input-material').value = '40Cr调质';
  document.getElementById('input-moment').value = '0';
  updatePinSuggestion();
  // 隐藏自定义材料面板并清空
  var csPanel = document.getElementById('custom-spline');
  if (csPanel) csPanel.style.display = 'none';
  ['cs-compression','cs-shear','cs-bending','cs-wearPV','cs-wearFree'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var csHard = document.getElementById('cs-hardness'); if (csHard) csHard.value = '';
  document.getElementById('results-spline').innerHTML = `
    <div class="empty-state" id="empty-state-spline">
      <div class="icon">📋</div>
      <p>输入参数后点击 <strong>"开始计算"</strong></p>
      <p style="font-size:0.8rem;margin-top:4px">所有计算严格遵循 GB/T 3478.1-2008</p>
    </div>`;
}
