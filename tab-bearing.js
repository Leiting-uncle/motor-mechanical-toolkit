// ================================================================
// Tab 5: 轴承校核 — UI 桥接函数
// 所有计算均调用 bearing-calc.js 暴露的函数
// 禁止在页面内编写任何计算公式
// ================================================================

var bearingCurrentMode = 'SKF';  // 'SKF' | 'NSK'

// ---- 模式切换 ----
function toggleBearingMode(mode) {
  bearingCurrentMode = mode;
  var panel = document.getElementById('panel-bearing');

  document.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('mode-btn-' + mode.toLowerCase()).classList.add('active');

  if (mode === 'NSK') {
    panel.classList.add('mode-nsk');
  } else {
    panel.classList.remove('mode-nsk');
  }
}

// ---- 型号来源切换 ----
function toggleBearingSource() {
  var source = document.getElementById('brg-source').value;
  var dbGroup = document.getElementById('brg-db-group');
  var manualGroup = document.getElementById('brg-manual-group');

  if (source === 'manual') {
    dbGroup.style.display = 'none';
    manualGroup.style.display = 'block';
    document.getElementById('brg-internal-group').style.display = 'block';
  } else {
    dbGroup.style.display = '';
    manualGroup.style.display = 'none';
    document.getElementById('brg-internal-group').style.display = 'none';
  }
}

// ---- 轴承类型变更 ----
function onBearingTypeChange() {
  var type = document.getElementById('brg-type').value;
  var alphaGroup = document.getElementById('brg-ac-alpha-group');

  if (type === 'angularContactBall') {
    alphaGroup.style.display = '';
  } else {
    alphaGroup.style.display = 'none';
  }

  // 更新型号列表
  populateBearingModels(type);
}

// ---- 填充轴承型号列表 ----
function populateBearingModels(filterType) {
  var sel = document.getElementById('brg-model');
  sel.innerHTML = '';
  var models = getBearingCatalogByType(filterType || document.getElementById('brg-type').value);
  models.forEach(function(item) {
    var opt = document.createElement('option');
    opt.value = item.model;
    opt.textContent = item.model + ' — d' + item.d + '/D' + item.D + '/B' + item.B + ' (C=' + item.C + 'kN)';
    sel.appendChild(opt);
  });
}

// ---- 轴承型号选择 → 自动填充 ----
function onBearingDBSelect() {
  var model = document.getElementById('brg-model').value;
  var data = BEARING_CATALOG[model];
  if (!data) return;

  document.getElementById('brg-d').value = data.d;
  document.getElementById('brg-D').value = data.D;
  document.getElementById('brg-B').value = data.B;
  document.getElementById('brg-C').value = data.C;
  document.getElementById('brg-C0').value = data.C0;
  document.getElementById('brg-Pu').value = data.Pu || '0.5';

  document.getElementById('brg-Dw').value = data.Dw || '';
  document.getElementById('brg-Z').value = data.Z || '';
  document.getElementById('brg-Dpw').value = data.Dpw || '';

  // 更新轴承类型
  if (data.type && data.type !== document.getElementById('brg-type').value) {
    document.getElementById('brg-type').value = data.type;
    onBearingTypeChange();
  }

  // 角接触球轴承接触角
  if (data.alpha) {
    document.getElementById('brg-ac-alpha').value = data.alpha;
  }

  // 显示内部参数
  if (data.Dw) {
    document.getElementById('brg-internal-group').style.display = 'block';
  }
}

// ---- NSK 自定义预紧力 ----
function toggleNskCustomPreload() {
  var level = document.getElementById('nsk-preload').value;
  document.getElementById('nsk-custom-force-group').style.display = (level === 'custom') ? '' : 'none';
}

// ---- 轴系力学区域 ----
function toggleShaftSection() {
  var checked = document.getElementById('brg-includeShaft').checked;
  document.getElementById('brg-shaft-group').style.display = checked ? 'block' : 'none';
}

// ---- 刚度自动传递 (NSK → 轴系) ----
function autoFeedStiffness(k_radial) {
  if (k_radial > 0) {
    document.getElementById('shaft-k1').value = k_radial.toFixed(1);
    document.getElementById('shaft-k2').value = k_radial.toFixed(1);
  }
}

// ---- 加载示例 ----
function loadBearingExample(type) {
  switchTab('bearing');

  switch (type) {
    case 'motor':
      toggleBearingMode('SKF');
      document.getElementById('brg-source').value = 'catalog';
      toggleBearingSource();
      document.getElementById('brg-type').value = 'deepGrooveBall';
      onBearingTypeChange();
      populateBearingModels('deepGrooveBall');
      document.getElementById('brg-model').value = '6208';
      onBearingDBSelect();
      document.getElementById('brg-Fr').value = 2000;
      document.getElementById('brg-Fa').value = 500;
      document.getElementById('brg-n').value = 1500;
      document.getElementById('brg-lub').value = 'grease';
      document.getElementById('brg-isoVG').value = 'g_LGMT2';
      document.getElementById('brg-temp').value = 60;
      document.getElementById('brg-clean').value = 'normal';
      document.getElementById('brg-reliability').value = '90';
      document.getElementById('brg-appType').value = 'normal';
      document.getElementById('brg-includeShaft').checked = false;
      toggleShaftSection();
      break;

    case 'nsk':
      toggleBearingMode('NSK');
      document.getElementById('brg-source').value = 'catalog';
      toggleBearingSource();
      document.getElementById('brg-type').value = 'angularContactBall';
      onBearingTypeChange();
      populateBearingModels('angularContactBall');
      document.getElementById('brg-model').value = '7308B';
      onBearingDBSelect();
      document.getElementById('brg-ac-alpha').value = '40';
      document.getElementById('brg-Fr').value = 1500;
      document.getElementById('brg-Fa').value = 800;
      document.getElementById('brg-n').value = 8000;
      document.getElementById('brg-lub').value = 'oil';
      document.getElementById('brg-isoVG').value = 'g_NSK_MTS';
      document.getElementById('brg-temp').value = 45;
      document.getElementById('brg-clean').value = 'highClean';
      document.getElementById('nsk-preload').value = 'L';
      document.getElementById('nsk-cage').value = 'phenolic';
      document.getElementById('nsk-ball').value = 'steel';
      document.getElementById('nsk-precision').value = 'P5';
      document.getElementById('nsk-arrangement').value = 'DB';
      document.getElementById('brg-includeShaft').checked = false;
      toggleShaftSection();
      toggleNskCustomPreload();
      break;

    case 'full':
      loadBearingExample('motor');
      document.getElementById('brg-includeShaft').checked = true;
      toggleShaftSection();
      document.getElementById('shaft-d').value = 40;
      document.getElementById('shaft-L').value = 300;
      document.getElementById('shaft-k1').value = 80;
      document.getElementById('shaft-k2').value = 80;
      document.getElementById('shaft-mat').value = '45钢';
      document.getElementById('shaft-mrotor').value = 20;
      break;
  }

  // 自动计算
  setTimeout(function() { calcBearingUI(); }, 300);
}

// ---- 调试函数：打印所有输入参数 ----
function _debugBearingInputs() {
  var keys = ['brg-type','brg-source','brg-model','brg-d','brg-D','brg-B',
    'brg-Dw','brg-Z','brg-Dpw','brg-C','brg-C0','brg-Pu',
    'brg-Fr','brg-Fa','brg-n',
    'brg-lub','brg-isoVG','brg-clean','brg-temp',
    'brg-reliability','brg-appType',
    'nsk-preload','nsk-customForce','nsk-cage','nsk-ball','nsk-precision','nsk-arrangement',
    'shaft-d','shaft-L','shaft-k1','shaft-k2','shaft-mat','shaft-mrotor'
  ];
  keys.forEach(function(k) {
    var el = document.getElementById(k);
    if (!el) { console.log(k + ': ELEMENT NOT FOUND'); return; }
    console.log(k + ': ' + (el.type === 'checkbox' ? el.checked : el.value));
  });
}

// ---- 主 UI 计算桥接 ----
function calcBearingUI() {
  var p = {};  // params object
  // 模式
  p.mode = bearingCurrentMode;

  function _val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function _num(id) { var v = parseFloat(_val(id)); return isNaN(v) ? 0 : v; }
  function _int(id) { var v = parseInt(_val(id)); return isNaN(v) ? 0 : v; }

  // 轴承
  p.bearingType = _val('brg-type') || 'deepGrooveBall';
  p.d = _num('brg-d');
  p.D = _num('brg-D');
  p.B = _num('brg-B');
  p.Dw = _num('brg-Dw') || undefined;
  p.Z = _int('brg-Z') || undefined;
  p.Dpw = _num('brg-Dpw') || undefined;
  p.C_kN = _num('brg-C');
  p.C0_kN = _num('brg-C0');
  p.Pu_kN = _num('brg-Pu');

  // 角接触球轴承接触角
  p.alpha = _num('brg-ac-alpha');
  p.extra = { alpha: p.alpha };
  if (p.bearingType === 'angularContactBall') {
    var a = p.alpha;
    if (a <= 18) p.extra.sub = 'series15';
    else if (a <= 30) p.extra.sub = 'series25';
    else p.extra.sub = 'series40';
  }

  // 载荷
  p.Fr_N = _num('brg-Fr');
  p.Fa_N = _num('brg-Fa');
  p.n_rpm = _num('brg-n');

  // 润滑
  var isoVal = _val('brg-isoVG');
  if (isoVal && isoVal.startsWith('g_')) {
    p.greaseType = isoVal.substring(2);
    p.lubType = 'grease';
  } else {
    p.isoVG = parseInt(isoVal) || 68;
    p.lubType = _val('brg-lub') || 'grease';
  }
  p.T_op_C = _num('brg-temp') || 40;
  p.cleanliness = _val('brg-clean') || 'normal';

  // 参考转速 (从目录取得)
  var model = _val('brg-model');
  var catData = BEARING_CATALOG[model];
  p.speedGrease = catData ? (catData.speedGrease || 0) : 0;
  p.speedOil = catData ? (catData.speedOil || 0) : 0;

  // SKF 参数
  p.reliability = _int('brg-reliability') || 90;
  p.applicationType = _val('brg-appType') || 'normal';
  p.loadCondition = 'rotatingIR';  // 默认电机工况

  // NSK 参数
  p.preloadLevel = _val('nsk-preload') || 'L';
  p.customForce_N = _num('nsk-customForce');
  p.cageType = _val('nsk-cage') || 'phenolic';
  p.ballMaterial = _val('nsk-ball') || 'steel';
  p.precision = _val('nsk-precision') || 'P5';
  p.arrangement = _val('nsk-arrangement') || 'DB';

  // 轴系
  var cbShaft = document.getElementById('brg-includeShaft');
  p.includeShaft = cbShaft ? !!cbShaft.checked : false;
  if (p.includeShaft) {
    p.k_brg1_N_um = _num('shaft-k1') || 50;
    p.k_brg2_N_um = _num('shaft-k2') || 50;
    p.L_bearing_mm = _num('shaft-L') || 300;
    p.d_shaft = _num('shaft-d') || 40;
    p.m_rotor_kg = _num('shaft-mrotor') || 20;
    p.shaftMaterial = _val('shaft-mat') || '45钢';
  }

  // 验证
  if (p.C_kN <= 0) {
    alert('请填写基本额定动载荷 C (kN)');
    return;
  }
  if (p.Fr_N <= 0 && p.Fa_N <= 0) {
    alert('请至少填写一个载荷值 Fr 或 Fa');
    return;
  }
  if (p.n_rpm <= 0) {
    alert('请填写转速 n (rpm)');
    return;
  }

  // 调用计算
  try {
    var result = calcBearingAll(p);
    if (result.error) {
      alert(result.message);
      return;
    }
    renderBearingResults(result);

    // 自动传递刚度
    if (p.includeShaft && result.nsk && result.nsk.stiffness) {
      autoFeedStiffness(result.nsk.stiffness.k_radial_N_um);
    }

    document.getElementById('results-bearing').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    console.error(e);
    alert('计算出错：' + e.message);
  }
}

// ---- 结果渲染 ----
function renderBearingResults(r) {
  var container = document.getElementById('results-bearing');
  if (!container) { alert('未找到结果容器 #results-bearing'); return; }

  try {
    _renderBearingResultsImpl(r, container);
  } catch (e) {
    console.error(e);
    alert('渲染结果出错: ' + e.message);
  }
}

function _renderBearingResultsImpl(r, container) {
  var s = r.skf;
  var life = s.life;
  var html = '';

  // Status helper
  function sc(status) {
    if (status === 'qualified') return 'status-qualified';
    if (status === 'warning') return 'status-warning';
    return 'status-fail';
  }
  function sf(n) { return isFinite(n) ? '<span class="tag">' + n.toFixed(1) + '</span>' : '∞'; }

  // ======== R1: 寿命计算结果 ========
  html += '<div class="section-card">';
  html += '<div class="section-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">';
  html += '📊 寿命计算结果 ';
  html += '<span style="font-weight:400;margin-left:8px;font-size:0.85rem">';
  html += 'L10h=' + (isFinite(life.L10h_hours) ? life.L10h_hours.toLocaleString() + 'h' : '∞');
  html += ' | ' + life.lifeCategory;
  html += '</span><span style="font-size:0.75rem;margin-left:auto">▼</span>';
  html += '</div><div class="section-body">';

  html += '<table class="param-table"><thead><tr><th>参数</th><th>数值</th><th>说明</th></tr></thead><tbody>';
  html += '<tr><td>轴承类型</td><td>' + life.bearingName + '</td><td>' + life.family + ' (p=' + life.p + ')</td></tr>';
  html += '<tr><td>当量动载荷 <em>P</em></td><td><strong>' + life.P_N.toFixed(0) + ' N</strong></td><td>' + life.load_factors.formula + '</td></tr>';
  html += '<tr><td>C/P 比</td><td>' + life.C_P_ratio.toFixed(1) + '</td><td>载荷率 = ' + ((life.P_N/1000)/life.C_kN).toFixed(3) + '</td></tr>';
  html += '<tr><td>基本额定寿命 L₁₀</td><td><strong>' + life.L10_mr.toFixed(1) + ' ×10⁶转</strong></td><td>= ' + (isFinite(life.L10h_hours) ? life.L10h_hours.toLocaleString() + ' h' : '∞') + '</td></tr>';
  html += '<tr><td>修正额定寿命 ' + life.Lnm_label + '</td><td><strong>' + life.Lnm_mr.toFixed(1) + ' ×10⁶转</strong></td><td>= ' + (isFinite(life.Lnmh_hours) ? life.Lnmh_hours.toLocaleString() + ' h' : '∞') + ' (' + life.lifeNmCategory + ')</td></tr>';
  html += '<tr><td>可靠度系数 a₁</td><td>' + life.a1.toFixed(2) + '</td><td>可靠度 ' + (r.skf.life.a1 === 1 ? '90%' : '>' + '90%') + '</td></tr>';
  html += '<tr><td>SKF寿命系数 aSKF</td><td><span class="' + sc(life.aSKF >= 1 ? 'qualified' : 'warning') + '">' + life.aSKF.toFixed(1) + '</span></td><td>' + (r.skf._aSKFresult ? r.skf._aSKFresult.note : '') + '</td></tr>';
  html += '</tbody></table>';

  html += '<div class="formula-block">' + life.summary + '</div>';
  html += '</div></div>';

  // ======== R2: 静强度 ========
  var ss = s.staticSafety;
  html += '<div class="section-card">';
  html += '<div class="section-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">';
  html += '🛡️ 静强度校核 ';
  html += '<span class="status-badge ' + sc(ss.status) + '">s₀ = ' + (isFinite(ss.s0) ? ss.s0.toFixed(1) : '∞') + '</span>';
  html += '<span style="font-size:0.75rem;margin-left:auto">▼</span>';
  html += '</div><div class="section-body">';
  html += '<table class="param-table"><tbody>';
  html += '<tr><td>当量静载荷 P₀</td><td><strong>' + life.P0_N.toFixed(0) + ' N</strong></td><td>C₀ / P₀ = ' + (isFinite(ss.s0) ? ss.s0.toFixed(1) : '∞') + '</td></tr>';
  html += '<tr><td>要求最小 s₀</td><td>' + ss.minRequired.toFixed(2) + '</td><td>' + ss.applicationType + '</td></tr>';
  html += '<tr><td>判定</td><td><span class="status-badge ' + sc(ss.status) + '">' + ss.statusText + '</span></td><td>' + (ss.adjustNote || '') + '</td></tr>';
  html += '</tbody></table>';
  html += '<div class="formula-block">' + ss.formula.replace(/\n/g,'<br>') + '</div>';
  html += '</div></div>';

  // ======== R3: 粘度 ========
  html += '<div class="section-card">';
  html += '<div class="section-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">';
  html += '💧 粘度特性 ';
  html += '<span class="status-badge ' + sc(life.kappa >= 1 ? 'qualified' : (life.kappa >= 0.4 ? 'warning' : 'fail')) + '">κ = ' + life.kappa.toFixed(2) + '</span>';
  html += '<span style="font-size:0.75rem;margin-left:auto">▼</span>';
  html += '</div><div class="section-body">';
  html += '<table class="param-table"><tbody>';
  html += '<tr><td>dm = (d+D)/2</td><td>' + life.dm.toFixed(0) + ' mm</td></tr>';
  html += '<tr><td>工作粘度 ν</td><td>' + life.nu_mm2s.toFixed(1) + ' mm²/s</td><td>在 ' + (r.skf._viscResult ? r.skf._viscResult.nu40 : '') + '</td></tr>';
  html += '<tr><td>额定粘度 ν₁</td><td>' + life.nu1_mm2s.toFixed(1) + ' mm²/s</td><td>SKF 图1: dm=' + life.dm.toFixed(0) + ', n=' + (parseFloat(document.getElementById('brg-n').value)||0) + '</td></tr>';
  html += '<tr><td>粘度比 κ</td><td><strong>' + life.kappa.toFixed(3) + '</strong></td><td>' + (life.kappa >= 2 ? '充分润滑 ✓' : (life.kappa >= 1 ? '边界润滑' : '润滑不足 ⚠')) + '</td></tr>';
  html += '</tbody></table>';
  html += '</div></div>';

  // ======== R4: 摩擦功耗 ========
  var fr = s.friction;
  if (!fr.error) {
    html += '<div class="section-card">';
    html += '<div class="section-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">';
    html += '⚡ 摩擦与功率损失 ';
    html += '<span style="font-weight:400">' + fr.P_loss_W.toFixed(1) + ' W | M=' + fr.M_total_Nmm.toFixed(1) + ' N·mm</span>';
    html += '<span style="font-size:0.75rem;margin-left:auto">▼</span>';
    html += '</div><div class="section-body">';
    html += '<table class="param-table"><tbody>';
    html += '<tr><td>滚动摩擦力矩 Mrr</td><td>' + fr.Mrr_Nmm.toFixed(2) + ' N·mm</td></tr>';
    html += '<tr><td>滑动摩擦力矩 Msl</td><td>' + fr.Msl_Nmm.toFixed(2) + ' N·mm</td></tr>';
    html += '<tr><td>总摩擦力矩 M</td><td><strong>' + fr.M_total_Nmm.toFixed(2) + ' N·mm</strong></td></tr>';
    html += '<tr><td>功率损失</td><td><strong>' + fr.P_loss_W.toFixed(2) + ' W</strong></td></tr>';
    html += '</tbody></table>';
    html += '<div class="formula-block">' + fr.formula.replace(/\n/g,'<br>') + '</div>';
    html += '</div></div>';
  }

  // ======== R5: 转速 ========
  var sp = s.speed;
  html += '<div class="section-card">';
  html += '<div class="section-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">';
  html += '🏃 极限转速校核 ';
  html += '<span class="status-badge ' + sc(sp.status) + '">' + (sp.ratio*100).toFixed(0) + '%</span>';
  html += '<span style="font-size:0.75rem;margin-left:auto">▼</span>';
  html += '</div><div class="section-body">';
  html += '<table class="param-table"><tbody>';
  html += '<tr><td>参考极限转速</td><td>' + sp.refSpeed_rpm + ' rpm</td></tr>';
  html += '<tr><td>修正后极限转速</td><td><strong>' + sp.adjustedSpeed_rpm.toFixed(0) + ' rpm</strong></td><td>f_load=' + sp.loadFactor.toFixed(2) + ', f_size=' + sp.sizeFactor.toFixed(2) + '</td></tr>';
  html += '<tr><td>运行/极限 比</td><td>' + sp.ratio.toFixed(2) + '</td><td>' + sp.statusText + '</td></tr>';
  html += '</tbody></table>';
  html += '</div></div>';

  // ======== R6: 配合与游隙 ========
  var ft = s.fits;
  var cl = s.clearance;
  html += '<div class="section-card">';
  html += '<div class="section-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">';
  html += '📏 配合与游隙 ';
  html += '<span style="font-weight:400">轴: ' + ft.shaftFit + ' | 座孔: ' + ft.housingFit + ' | ' + cl.grade + '</span>';
  html += '<span style="font-size:0.75rem;margin-left:auto">▼</span>';
  html += '</div><div class="section-body">';
  html += '<table class="param-table"><tbody>';
  html += '<tr><td>载荷类型</td><td>' + ft.loadCategory + '</td></tr>';
  html += '<tr><td>轴配合推荐</td><td><strong>' + ft.shaftFit + '</strong></td><td>' + ft.shaftDesc + '</td></tr>';
  html += '<tr><td>座孔配合推荐</td><td><strong>' + ft.housingFit + '</strong></td><td>' + ft.housingDesc + '</td></tr>';
  html += '<tr><td>游隙推荐</td><td><strong>' + cl.grade + ' — ' + cl.name.split('—')[1] + '</strong></td><td>' + cl.condition + '</td></tr>';
  html += '<tr><td>判定依据</td><td colspan="2">' + cl.reasons + '</td></tr>';
  if (cl.note) html += '<tr><td colspan="3" class="status-warning">' + cl.note + '</td></tr>';
  html += '</tbody></table>';
  html += '</div></div>';

  // ======== R7: 润滑建议 ========
  var rl = s.relubrication;
  html += '<div class="section-card">';
  html += '<div class="section-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">';
  html += '🧴 润滑建议 ';
  html += '<span class="status-badge ' + sc(rl.status) + '">' + (rl.interval_h > 0 ? rl.interval_h.toLocaleString() + 'h' : 'N/A') + '</span>';
  html += '<span style="font-size:0.75rem;margin-left:auto">▼</span>';
  html += '</div><div class="section-body">';
  html += '<table class="param-table"><tbody>';
  html += '<tr><td>再润滑间隔</td><td><strong>' + (rl.interval_h > 0 ? rl.interval_h.toLocaleString() + ' h' : 'N/A') + '</strong></td><td>原始: ' + rl.interval_h_raw.toFixed(0) + 'h, 温度修正: ×' + rl.tempFactor.toFixed(2) + '</td></tr>';
  html += '<tr><td>注脂量</td><td><strong>≈ ' + rl.grease_qty_g.toFixed(1) + ' g</strong></td></tr>';
  html += '<tr><td>建议</td><td colspan="2">' + rl.method + '</td></tr>';
  html += '</tbody></table>';
  html += '<div class="formula-block">' + rl.formula.replace(/\n/g,'<br>') + '</div>';
  html += '</div></div>';

  // ======== R8: NSK 高速结果 ========
  if (r.nsk) {
    var nk = r.nsk;
    html += '<div class="section-card" style="border-left:3px solid #e74c3c">';
    html += '<div class="section-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">';
    html += '🔴 NSK 高速轴承分析 ';
    html += '<span style="font-weight:400">k_r=' + nk.stiffness.k_radial_N_um.toFixed(0) + ' N/μm</span>';
    html += '<span style="font-size:0.75rem;margin-left:auto">▼</span>';
    html += '</div><div class="section-body">';

    html += '<table class="param-table"><thead><tr><th>参数</th><th>数值</th><th>说明</th></tr></thead><tbody>';
    html += '<tr><td>预紧力</td><td><strong>' + nk.stiffness.F_pre_N.toFixed(0) + ' N</strong></td><td>' + nk.stiffness.preloadDesc + '</td></tr>';
    html += '<tr><td>轴向刚度 kₐ</td><td><strong>' + nk.stiffness.k_axial_N_um.toFixed(1) + ' N/μm</strong></td></tr>';
    html += '<tr><td>径向刚度 k_r</td><td><strong style="color:var(--accent)">' + nk.stiffness.k_radial_N_um.toFixed(1) + ' N/μm</strong></td><td>可传入轴系力学</td></tr>';
    html += '<tr><td>极限转速 (脂)</td><td>' + nk.speed.n_limit_grease.toFixed(0) + ' rpm</td><td>油: ' + nk.speed.n_limit_oil.toFixed(0) + ' rpm</td></tr>';
    html += '<tr><td>dm·n 值</td><td><span class="dmn-highlight">' + nk.speed.dm_n_value.toLocaleString() + '</span> mm·rpm</td><td>极限: ' + nk.speed.dm_n_limit.toLocaleString() + '</td></tr>';
    html += '<tr><td>隔圈长度差 ΔL</td><td>' + nk.spacer.deltaL_mm.toFixed(3) + ' mm</td><td>范围: ' + nk.spacer.min_mm.toFixed(2) + ' - ' + nk.spacer.max_mm.toFixed(2) + ' mm</td></tr>';
    html += '<tr><td>排列方式</td><td>' + (nk.arrangement ? nk.arrangement.name : 'DB') + '</td></tr>';
    // NSK 修正寿命
    html += '<tr><td>NSK修正寿命</td><td><strong>' + (isFinite(nk.life.nskAdjustedLnmh) ? nk.life.nskAdjustedLnmh.toLocaleString() + ' h' : '∞') + '</strong></td><td>' + (nk.life.note || '') + '</td></tr>';
    html += '</tbody></table>';

    html += '<div class="alert alert-info" style="margin-top:8px">';
    html += '<strong>轴承配置建议：</strong> ' + (nk.arrangement ? nk.arrangement.description : '') + '<br>';
    html += '精度: ' + (nk.precision ? nk.precision.name : 'P5') + ' | 球材料: ' + (nk.ballMaterial ? nk.ballMaterial.name : '钢') + ' | 保持架: ' + (nk.cageType ? nk.cageType.name : '酚醛') + '<br>';
    html += '隔圈: 内隔圈比外隔圈长 <strong>' + nk.spacer.deltaL_mm.toFixed(3) + 'mm</strong>（安装后产生 ' + nk.stiffness.F_pre_N.toFixed(0) + 'N 预紧）';
    html += '</div>';

    html += '</div></div>';
  }

  // ======== R9: 轴系力学 ========
  if (r.shaft) {
    var sh = r.shaft;
    var cs = sh.criticalSpeed;
    var df = sh.deflection;
    var ts = sh.torsional;

    html += '<div class="section-card" style="border-left:3px solid #27ae60">';
    html += '<div class="section-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">';
    html += '🛠️ 轴系力学分析 ';
    html += '<span class="status-badge ' + sc(cs.status) + '">n_crit=' + (isFinite(cs.n_crit_rpm) ? cs.n_crit_rpm.toLocaleString() + 'rpm' : '∞') + '</span>';
    html += '<span style="font-size:0.75rem;margin-left:auto">▼</span>';
    html += '</div><div class="section-body">';

    html += '<h4 style="margin-top:8px">📐 弯曲临界转速 (Rayleigh法)</h4>';
    html += '<table class="param-table"><tbody>';
    html += '<tr><td>临界转速 n_crit</td><td><strong style="font-size:1.1em">' + (isFinite(cs.n_crit_rpm) ? cs.n_crit_rpm.toLocaleString() + ' rpm' : '∞') + '</strong></td></tr>';
    html += '<tr><td>固有频率</td><td>' + (isFinite(cs.f_hz) ? cs.f_hz.toFixed(1) + ' Hz' : '∞') + '</td></tr>';
    html += '<tr><td>静挠度</td><td>' + cs.deflection_um.toFixed(1) + ' μm</td><td>刚性: ' + cs.y_rigid_um + 'μm, 轴承: ' + cs.y_bearing_um + 'μm</td></tr>';
    html += '<tr><td>轴系类型</td><td><span class="status-badge ' + sc(cs.status) + '">' + cs.shaftType + '</span></td></tr>';
    html += '<tr><td>运行/临界速比</td><td>' + cs.safety_ratio.toFixed(3) + '</td><td>' + (cs.safety_ratio < 0.7 ? '低于临界转速，安全 ✓' : (cs.safety_ratio > 1.3 ? '高于临界转速，超临界运行' : '共振区 ⚠')) + '</td></tr>';
    html += '</tbody></table>';

    if (cs.warnings.length > 0) {
      cs.warnings.forEach(function(w) {
        html += '<div class="alert alert-' + (w.startsWith('⚠') ? 'danger' : 'warning') + '">' + w + '</div>';
      });
    }

    html += '<h4 style="margin-top:8px">📏 挠度校核</h4>';
    html += '<table class="param-table"><tbody>';
    html += '<tr><td>最大挠度</td><td><strong>' + df.maxDeflection_um.toFixed(2) + ' μm</strong></td><td>允许: ≤' + df.maxAllowable_um.toFixed(0) + 'μm</td></tr>';
    html += '<tr><td>弯曲挠度</td><td>' + df.y_beam_um + ' μm</td></tr>';
    html += '<tr><td>轴承弹性挠度</td><td>' + df.y_bearing_um + ' μm</td></tr>';
    html += '<tr><td>判定</td><td><span class="status-badge ' + sc(df.status) + '">' + df.statusText + '</span></td></tr>';
    html += '</tbody></table>';

    html += '<h4 style="margin-top:8px">🔄 扭转刚度</h4>';
    html += '<table class="param-table"><tbody>';
    html += '<tr><td>扭转刚度 Kt</td><td><strong>' + (ts.Kt_Nm_rad / 1000).toFixed(1) + ' kN·m/rad</strong></td></tr>';
    html += '<tr><td>扭转固有频率</td><td><strong>' + (isFinite(ts.f_hz) ? ts.f_hz.toFixed(1) + ' Hz' : '∞') + '</strong></td><td>轴的极惯性矩 I_p=' + ts.I_p_shaft_kgm2 + ' kg·m²</td></tr>';
    html += '</tbody></table>';

    html += '<div class="formula-block">' + cs.formula.replace(/\n/g,'<br>') + '</div>';
    html += '</div></div>';
  }

  // ======== R10: 计算详情 ========
  html += '<div class="section-card collapsed">';
  html += '<div class="section-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">';
  html += '📋 中间计算详情 <span style="font-size:0.75rem;margin-left:auto">▼</span>';
  html += '</div><div class="section-body">';
  html += '<div class="formula-block">' + life._basicLife.formula.replace(/\n/g,'<br>') + '</div>';
  html += '<div class="formula-block">' + life._aSKFresult.formula.replace(/\n/g,'<br>') + '</div>';
  html += '<div class="formula-block">' + (life._viscResult ? life._viscResult.formula : '') + '</div>';
  html += '<div class="formula-block">' + (life._nu1Result ? life._nu1Result.formula : '') + '</div>';
  if (r.shaft) {
    html += '<div class="formula-block">' + r.shaft.torsional.formula.replace(/\n/g,'<br>') + '</div>';
  }
  html += '</div></div>';

  container.innerHTML = html;
}  // end _renderBearingResultsImpl

// ---- 重置 ----
function resetBearing() {
  document.getElementById('brg-type').value = 'deepGrooveBall';
  onBearingTypeChange();
  populateBearingModels('deepGrooveBall');
  document.getElementById('brg-model').value = '6208';
  onBearingDBSelect();
  document.getElementById('brg-source').value = 'catalog';
  toggleBearingSource();
  document.getElementById('brg-Fr').value = 2000;
  document.getElementById('brg-Fa').value = 500;
  document.getElementById('brg-n').value = 1500;
  document.getElementById('brg-lub').value = 'grease';
  document.getElementById('brg-isoVG').value = 'g_LGMT2';
  document.getElementById('brg-temp').value = 60;
  document.getElementById('brg-clean').value = 'normal';
  document.getElementById('brg-reliability').value = '90';
  document.getElementById('brg-appType').value = 'normal';
  document.getElementById('brg-includeShaft').checked = false;
  toggleShaftSection();
  document.getElementById('nsk-preload').value = 'L';
  toggleNskCustomPreload();
  document.getElementById('nsk-cage').value = 'phenolic';
  document.getElementById('nsk-ball').value = 'steel';
  document.getElementById('nsk-precision').value = 'P5';
  document.getElementById('nsk-arrangement').value = 'DB';
  toggleBearingMode('SKF');

  document.getElementById('results-bearing').innerHTML =
    '<div class="empty-state"><div class="icon">🔧</div><p>选择轴承参数后点击 <strong>"开始校核计算"</strong></p><p style="font-size:0.8rem;margin-top:4px">常规转速：SKF 方法 | 高速：NSK 方法</p></div>';
}
