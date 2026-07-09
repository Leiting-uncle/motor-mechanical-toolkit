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

// ---- 加载示例 (GB/T 3478.1-2008 附录 C) ----
function loadSplineExample(type) {
  // 所有 5 个几何示例共用: m=1.0, z=25, pin=0(自动), power=0, speed=0, moment=0
  var pin=0, power=0, speed=0, moment=0;
  var torque=0; // 几何示例不涉及强度，转矩=0 跳过校核

  // 强度校核示例 (GB/T 17855-1999 例1) 参数
  if (type === 'gb17855') {
    // 重置自定义材料面板
    var csPanel = document.getElementById('custom-spline');
    if (csPanel) csPanel.style.display = 'block';

    document.getElementById('input-m').value = '2';
    document.getElementById('input-z').value = '44';
    document.getElementById('input-grade').value = '5';
    document.getElementById('input-fit').value = 'H/h';
    document.getElementById('input-root').value = 'filletRoot';
    document.getElementById('input-pin').value = '0';
    document.getElementById('input-length').value = '32';
    document.getElementById('input-torque').value = '0';
    document.getElementById('input-power').value = '1500';
    document.getElementById('input-speed').value = '1250';
    document.getElementById('input-material').value = 'custom';
    document.getElementById('input-moment').value = '0';

    // 填充自定义材料：优质合金钢 σ_0.2≥835, σ_b≥980, HB 293-341
    var csY = document.getElementById('cs-yield'); if (csY) csY.value = '835';
    var csT = document.getElementById('cs-tensile'); if (csT) csT.value = '980';
    var csHT = document.getElementById('cs-hardType'); if (csHT) csHT.value = 'HB';
    var csHV = document.getElementById('cs-hardVal'); if (csHV) csHV.value = '293';
    var csHL = document.getElementById('cs-hardness'); if (csHL) csHL.value = '优质合金钢 HB293-341';

    // 设置计算方法为 GB/T 17855-1999
    var methodSel = document.getElementById('input-method');
    if (methodSel) methodSel.value = 'gb17855';
    // 设置工况类型 + 同步 K1-K4 系数
    var appSel = document.getElementById('input-appType');
    if (appSel) appSel.value = 'gasTurbine_propeller';
    // 确保 gb17855 面板可见
    var appGroup = document.getElementById('appType-group');
    if (appGroup) appGroup.style.display = '';
    var coeffGroup = document.getElementById('coeff-group');
    if (coeffGroup) coeffGroup.style.display = '';
    // 同步系数
    if (typeof syncCoeffFromAppType === 'function') syncCoeffFromAppType();

    updatePinSuggestion();
    calcSpline();
    return;
  }

  switch(type) {
    case 'c1': // C.1 INT 25z×1.0m×30P×5H — 内花键 平齿根 5级 H配合
      document.getElementById('input-m').value = '1';
      document.getElementById('input-z').value = '25';
      document.getElementById('input-grade').value = '5';
      document.getElementById('input-fit').value = 'H/h';
      document.getElementById('input-root').value = 'flatRoot';
      break;
    case 'c2': // C.2 INT 25z×1.0m×30R×7H — 内花键 圆齿根 7级 H配合
      document.getElementById('input-m').value = '1';
      document.getElementById('input-z').value = '25';
      document.getElementById('input-grade').value = '7';
      document.getElementById('input-fit').value = 'H/h';
      document.getElementById('input-root').value = 'filletRoot';
      break;
    case 'c3': // C.3 EXT 25z×1.0m×30R×4h — 外花键 圆齿根 4级 h配合
      document.getElementById('input-m').value = '1';
      document.getElementById('input-z').value = '25';
      document.getElementById('input-grade').value = '4';
      document.getElementById('input-fit').value = 'H/h';
      document.getElementById('input-root').value = 'filletRoot';
      break;
    case 'c4': // C.4 EXT 25z×1.0m×30R×6e — 外花键 圆齿根 6级 e配合
      document.getElementById('input-m').value = '1';
      document.getElementById('input-z').value = '25';
      document.getElementById('input-grade').value = '6';
      document.getElementById('input-fit').value = 'H/e';
      document.getElementById('input-root').value = 'filletRoot';
      break;
    case 'c5': // C.5 EXT 25z×1.0m×30P×5js — 外花键 平齿根 5级 js配合
      document.getElementById('input-m').value = '1';
      document.getElementById('input-z').value = '25';
      document.getElementById('input-grade').value = '5';
      document.getElementById('input-fit').value = 'H/js';
      document.getElementById('input-root').value = 'flatRoot';
      break;
  }

  document.getElementById('input-pin').value = pin;
  document.getElementById('input-length').value = '12.5';  // GB示例: g=D/2=12.5mm
  document.getElementById('input-torque').value = torque;
  document.getElementById('input-power').value = power;
  document.getElementById('input-speed').value = speed;
  document.getElementById('input-material').value = '40Cr调质';
  document.getElementById('input-moment').value = moment;

  // 几何示例默认使用简化计算方法
  var methodSel = document.getElementById('input-method');
  if (methodSel) methodSel.value = 'simplified';

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

  // 处理自定义材料 — 用户输入 σ_b/σ_0.2/硬度，自动计算各项许用应力
  let customMaterial = null;
  if (material === 'custom') {
    var csYield = readCustomVal('cs-yield') || 835;    // σ_0.2 (MPa)
    var csTensile = readCustomVal('cs-tensile') || 980; // σ_b (MPa)
    var csHardVal = parseFloat(document.getElementById('cs-hardVal')?.value) || 293;
    var csHardType = document.getElementById('cs-hardType')?.value || 'HB';
    var csHardLabel = (csHardType === 'HB')
      ? ('HB' + csHardVal)
      : ('HRC' + csHardVal);

    // 由强度自动推算许用值（安全系数内置）
    customMaterial = {
      allowableCompression: Math.round(csYield / 1.2),       // [σ_H] ≈ σ_0.2 / 1.2
      allowableShear: Math.round(csYield * 0.58),             // [τ] ≈ 0.58 × σ_0.2
      allowableBending: Math.round(csTensile / 1.5),          // [σ_F] ≈ σ_b / 1.5
      allowableWearPV: Math.round(csYield * 0.012 * 10) / 10, // [p·v] ≈ 0.012 × σ_0.2
      allowableWearFreeContact: Math.round(csHardVal * (csHardType === 'HRC' ? 0.3 : 0.032)), // 表5
      hardness: csHardLabel
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

  // ---- GB/T 17855-1999 强度计算（可选） ----
  var methodEl = document.getElementById('input-method');
  var useMethod = methodEl ? methodEl.value : 'simplified';
  var effectiveTorque = result.strength ? result.strength.torque : 0;

  if (useMethod === 'gb17855' && effectiveTorque > 0) {
    try {
      // 从几何结果提取参数
      var gb_D = result.basic.分度圆直径_D;
      var gb_S_basic = result.basic.基本齿厚_S;
      var gb_D_ee = result.external.大径_D_ee.basic;
      var gb_D_ie = result.external.小径_D_ie.basic;
      var gb_D_Fe = parseFloat(result.external.渐开线起始圆_D_Fe_max);
      var gb_L_eng = result.tolerance.配合长度_L_mm;

      // 工作齿高 h_w ≈ m（标准基本齿廓 ha*=0.5）
      var gb_h_w = m;
      // 全齿高 h = (D_ee - D_ie) / 2
      var gb_h = (gb_D_ee - gb_D_ie) / 2;
      // 齿根圆角半径 ρ — 从 BASIC_PROFILE_30 读取标准值
      var profileData = BASIC_PROFILE_30[root] || BASIC_PROFILE_30['filletRoot'];
      var gb_rho = profileData.rootFilletCoeff * m;

      // 材料强度参数
      var gb_sigma02, gb_sigmaB, gb_HB;
      if (material === 'custom') {
        // 自定义材料：直接从输入框读取 σ_b 和 σ_0.2
        gb_sigma02 = readCustomVal('cs-yield') || 835;
        gb_sigmaB = readCustomVal('cs-tensile') || 980;
        var csHardLabel = document.getElementById('cs-hardness');
        gb_HB = parseFloat(document.getElementById('cs-hardVal')?.value) || 293;
      } else {
        // 预设材料：从 MATERIAL_PROPERTIES 反推近似值
        var matAllowComp = result.strength ? result.strength.contact.allowable_MPa : 140;
        gb_sigma02 = matAllowComp * 2.8; // 近似：σ_0.2 ≈ 2.8 × [σ_H]
        gb_sigmaB = gb_sigma02 * 1.17;  // 近似：σ_b ≈ 1.17 × σ_0.2
        gb_HB = 280; // 默认
      }

      // 工况系数 — 优先读取自定义输入值，否则使用预设
      var appEl = document.getElementById('input-appType');
      var appKey = appEl ? appEl.value : 'gasTurbine_propeller';
      var presetFactors = GB17855_APP_TYPES[appKey] || GB17855_APP_TYPES['gasTurbine_propeller'];
      // 允许用户通过 coeff- 输入框覆盖预设值
      function readCoeff(id, fallback) {
        var el = document.getElementById(id);
        return (el && el.value !== '') ? parseFloat(el.value) : fallback;
      }
      var appFactors = {
        name: presetFactors.name,
        K1: readCoeff('coeff-K1', presetFactors.K1),
        K2: readCoeff('coeff-K2', presetFactors.K2),
        K3: readCoeff('coeff-K3', presetFactors.K3),
        K4: readCoeff('coeff-K4', presetFactors.K4),
        S_H: readCoeff('coeff-SH', presetFactors.S_H),
        S_F: readCoeff('coeff-SF', presetFactors.S_F)
      };

      // 磨损等级 — 按材料硬度和热处理状态
      var wearGrade = (gb_sigma02 >= 835) ? 'alloySteel_quenched' : 'carbonSteel_quenched';

      var gbResult = calcGB17855All({
        m: m, z: z,
        D: gb_D, S_basic: gb_S_basic,
        D_ee: gb_D_ee, D_ie: gb_D_ie, D_Fe: gb_D_Fe,
        L_eng: gb_L_eng,
        h_w: gb_h_w, h: gb_h, rho: gb_rho,
        torque: effectiveTorque,
        sigma02: gb_sigma02, sigmaB: gb_sigmaB, HB: gb_HB,
        appFactors: appFactors,
        wearGrade: wearGrade,
        bendingMoment: moment
      });

      // 将 GB17855 结果附加到 result
      result._gb17855 = gbResult;
      result._method = 'gb17855';
      result._appFactors = appFactors;
    } catch (e) {
      console.error('GB/T 17855-1999 计算出错，回退到简化方法:', e);
      result._method = 'simplified';
    }
  } else {
    result._method = 'simplified';
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
        <tr><td>渐开线起始圆 D<sub>Fe max</sub></td><td>φ${ext.渐开线起始圆_D_Fe_max} mm</td></tr>
        <tr><td>齿厚 S<sub>实际</sub></td><td>${fmtRange(ext.齿厚.actual_max, ext.齿厚.actual_min)} (es<sub>v</sub>=${ext.齿厚.es_v_um}μm, T=${ext.齿厚.tolerance_T}mm)</td></tr>
        <tr style="background:#f8f4e8"><td>齿厚 S<sub>作用</sub></td><td>${fmtRange(ext.齿厚.action_max, ext.齿厚.action_min)} <span style="font-size:0.72rem;color:var(--text-light)">— 用于配合判定</span></td></tr>
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
        <tr><td>渐开线终止圆 D<sub>Fi min</sub></td><td>φ${int.渐开线终止圆_D_Fi_min} mm</td></tr>
        <tr><td>齿槽宽 E<sub>实际</sub></td><td>${fmtRange(int.齿槽宽.actual_max, int.齿槽宽.actual_min)} (EI=0, T=${int.齿槽宽.tolerance_T}mm)</td></tr>
        <tr style="background:#f8f4e8"><td>齿槽宽 E<sub>作用</sub></td><td>${fmtRange(int.齿槽宽.action_max, int.齿槽宽.action_min)} <span style="font-size:0.72rem;color:var(--text-light)">— 用于配合判定 (EI<sub>v</sub>=0)</span></td></tr>
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
    const gb = r._gb17855;
    const isGB = r._method === 'gb17855' && gb;
    const appF = r._appFactors;
    // 格式化辅助
    function toN4(v) { return typeof v === 'number' ? v.toFixed(4) : v; }

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
        🛡️ 强度校核 — ${s.material} (${s.materialHardness}) · T = ${s.torque} N·m${isGB
          ? ` · <span style="font-size:0.72rem;color:var(--accent);font-weight:600">GB/T 17855-1999</span> · S<sub>H</sub>=${appF.S_H} S<sub>F</sub>=${appF.S_F}`
          : ` · <span style="font-size:0.72rem;color:var(--text-light)">《机械设计手册》第五版</span>`}
        <span style="font-size:0.75rem;color:var(--text-light)">▼</span>
      </div>
      <div class="section-body">`;

    if (isGB) {
      // ===== GB/T 17855-1999 详细展示 =====
      html += `
        <div style="font-size:0.75rem;color:var(--text-light);margin-bottom:8px">
          ${s.torqueSource} | 工况：${appF ? appF.name : ''} |
          K<sub>1</sub>=${appF.K1} K<sub>2</sub>=${appF.K2} K<sub>3</sub>=${appF.K3} K<sub>4</sub>=${appF.K4}
        </div>
        <div class="alert alert-info" style="margin-bottom:8px;font-size:0.78rem">
          📐 中间计算：F<sub>t</sub> = 2000T/D = 2000×${s.torque}/${gb.input.D}
          = <strong>${gb.loads.Ft_N} N</strong> &nbsp;|&nbsp;
          W = F<sub>t</sub>/(z·l·cos30°) = <strong>${gb.loads.W_N_per_mm} N/mm</strong> &nbsp;|&nbsp;
          h<sub>w</sub>=${gb.input.h_w} mm, h=${gb.input.h} mm, ρ=${gb.input.rho} mm
        </div>
        <table class="param-table">
          <tr><th style="width:20%">校核项目</th><th style="width:30%">应力/值</th><th style="width:18%">安全系数</th><th style="width:32%">判定</th></tr>

          <tr>
            <td>① 齿面接触</td>
            <td style="font-family:var(--font-mono)">σ<sub>H</sub> = ${gb.contact.sigma_H_MPa} ≤ [${gb.contact.allowable_MPa}] MPa</td>
            <td style="font-family:var(--font-mono)">S<sub>H</sub> = ${gb.contact.safetyFactor}</td>
            <td><span class="status-badge ${statusClass(gb.contact.status)}">${gb.contact.status}</span></td></tr>

          <tr>
            <td>② 齿根弯曲</td>
            <td style="font-family:var(--font-mono)">σ<sub>F</sub> = ${gb.bending.sigma_F_MPa} ≤ [${gb.bending.allowable_MPa}] MPa</td>
            <td style="font-family:var(--font-mono)">S<sub>F</sub> = ${gb.bending.safetyFactor}</td>
            <td><span class="status-badge ${statusClass(gb.bending.status)}">${gb.bending.status}</span></td></tr>

          <tr style="background:#fafbfc;font-size:0.78rem">
            <td></td>
            <td colspan="3"><span style="color:var(--text-light)">
              S<sub>Fn</sub> = ${gb.bending.S_Fn_mm} mm &nbsp;|&nbsp;
              D<sub>Fe</sub> = ${gb.input.D_Fe} mm &nbsp;|&nbsp;
              S/D = ${toN4(gb.bending.sfnDetail.term_S_D)} &nbsp;|&nbsp;
              invα<sub>D</sub> = ${toN4(gb.bending.sfnDetail.invAlphaD)} &nbsp;|&nbsp;
              invα<sub>Fe</sub> = ${toN4(gb.bending.sfnDetail.invAlphaFe)}
            </span></td></tr>

          <tr>
            <td>③ 齿根剪切</td>
            <td style="font-family:var(--font-mono)">τ<sub>Fmax</sub> = ${gb.shear.tau_Fmax_MPa} ≤ [${gb.shear.allowable_MPa}] MPa</td>
            <td style="font-family:var(--font-mono)">S<sub>τ</sub> = ${gb.shear.safetyFactor}</td>
            <td><span class="status-badge ${statusClass(gb.shear.status)}">${gb.shear.status}</span></td></tr>

          <tr style="background:#fafbfc;font-size:0.78rem">
            <td></td>
            <td colspan="3"><span style="color:var(--text-light)">
              d<sub>h</sub> = ${gb.shear.dh_mm} mm &nbsp;|&nbsp;
              τ<sub>tn</sub> = ${gb.shear.tau_tn_MPa} MPa &nbsp;|&nbsp;
              α<sub>tn</sub> = ${gb.shear.alpha_tn} &nbsp;|&nbsp;
              [τ<sub>F</sub>] = [σ<sub>F</sub>]/2 = ${gb.shear.allowable_MPa} MPa
            </span></td></tr>

          <tr>
            <td>④ 耐磨 10⁶循环</td>
            <td style="font-family:var(--font-mono)">σ<sub>H</sub> = ${gb.wear.sigma_H_MPa} ≤ [σ<sub>H1</sub>] = ${gb.wear.wear10e6.allowable_H1_MPa} MPa (表4)</td>
            <td style="font-family:var(--font-mono)">${toN4(gb.wear.wear10e6.allowable_H1_MPa / gb.contact._sigma_H)}</td>
            <td><span class="status-badge ${statusClass(gb.wear.wear10e6.status)}">${gb.wear.wear10e6.status}</span></td></tr>

          <tr>
            <td>⑤ 长期无磨损</td>
            <td style="font-family:var(--font-mono)">σ<sub>H</sub> = ${gb.wear.sigma_H_MPa} ≤ 0.032×${gb.wear.wearLongTerm.HB} = ${gb.wear.wearLongTerm.allowable_H2_MPa} MPa (表5)</td>
            <td style="font-family:var(--font-mono)">m = ${toN4(gb.wear.wearLongTerm.allowable_H2_MPa / gb.contact._sigma_H)}</td>
            <td><span class="status-badge ${gb.wear.wearLongTerm.isWearFree ? 'status-qualified' : 'status-warning'}">${gb.wear.wearLongTerm.status}</span></td></tr>

          <tr>
            <td>⑥ 弯扭合成</td>
            <td style="font-family:var(--font-mono)">σ<sub>v</sub> = √(3×τ<sub>tn</sub>²) = ${gb.combined.sigma_v_MPa} ≤ [${gb.combined.allowable_MPa}] MPa</td>
            <td style="font-family:var(--font-mono)">${gb.combined.safetyFactor}</td>
            <td><span class="status-badge ${statusClass(gb.combined.status)}">${gb.combined.status}</span></td></tr>

        </table>
        ${!gb.wear.wearLongTerm.isWearFree ? `
        <div class="alert alert-warning" style="margin-top:8px">
          ⚠️ σ<sub>H</sub> = ${gb.wear.sigma_H_MPa} > [σ<sub>H2</sub>] = ${gb.wear.wearLongTerm.allowable_H2_MPa} MPa（0.032×HB），长期工作可能发生微动磨损。
        </div>` : ''}
        ${gb.wear.wear10e6.status === '合格' ? `
        <div class="alert alert-info" style="margin-top:4px">
          ✅ 10⁶循环内齿面无显著磨损（σ<sub>H</sub> ≤ [σ<sub>H1</sub>] = ${gb.wear.wear10e6.allowable_H1_MPa} MPa 表4）
        </div>` : ''}`;

    } else {
      // ===== 原有简化公式展示 =====
      html += `
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
        </div>`}`;
    }

    html += `
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
  ['cs-yield','cs-tensile','cs-hardVal'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var csHard = document.getElementById('cs-hardness'); if (csHard) csHard.value = '';
  var csHT = document.getElementById('cs-hardType'); if (csHT) csHT.value = 'HB';
  document.getElementById('results-spline').innerHTML = `
    <div class="empty-state" id="empty-state-spline">
      <div class="icon">📋</div>
      <p>输入参数后点击 <strong>"开始计算"</strong></p>
      <p style="font-size:0.8rem;margin-top:4px">所有计算严格遵循 GB/T 3478.1-2008</p>
    </div>`;
}
