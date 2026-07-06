// ================================================================
// Tab 6: 屏蔽套失效计算 — UI 桥接函数
// 所有计算均调用 sleeve-calc.js 暴露的函数
// 禁止在页面内编写任何计算公式
// ================================================================

// ---- 辅助：更新总厚度显示 ----
function updateSleeveTotalThickness() {
  var tply = parseFloat(document.getElementById('slv-input-tply').value) || 0;
  var nLayers = parseInt(document.getElementById('slv-input-nlayers').value) || 0;
  var R = parseFloat(document.getElementById('slv-input-R').value) || 1;
  var totalT = tply * nLayers;
  var Rt = (totalT > 0) ? (R / totalT).toFixed(1) : '--';
  var hint = document.getElementById('slv-thickness-hint');
  if (hint) {
    hint.innerHTML = '📐 总壁厚 t = ' + nLayers + ' × ' + tply.toFixed(3) +
      ' = <strong>' + totalT.toFixed(3) + '</strong> mm &nbsp;|&nbsp; R/t = <strong>' + Rt + '</strong>' +
      (Rt !== '--' && parseFloat(Rt) < 10 ? ' <span style="color:var(--warning)">⚠ 厚壁，薄壳假设可能不适用</span>' : '');
  }
}

// ---- 铺层模板切换 ----
function onSleeveLayupChange() {
  var template = document.getElementById('slv-input-layup').value;
  var anglesInput = document.getElementById('slv-input-angles');
  if (template === 'CUSTOM') {
    anglesInput.value = '';
    anglesInput.disabled = false;
    anglesInput.placeholder = '手动输入角度，逗号分隔，如: 45,-45,0,90';
  } else if (LAYUP_TEMPLATES[template]) {
    anglesInput.value = LAYUP_TEMPLATES[template].angles.join(',');
    anglesInput.disabled = false;
  }
}

// ---- 加载示例 ----
function loadSleeveExample(type) {
  switch(type) {
    case 'cfrp':
      // CFRP T700, [±45], 外压，典型电机屏蔽套
      document.getElementById('slv-input-R').value = '50';
      document.getElementById('slv-input-L').value = '200';
      document.getElementById('slv-input-tply').value = '0.125';
      document.getElementById('slv-input-nlayers').value = '16';
      document.getElementById('slv-input-layup').value = 'AP45';
      document.getElementById('slv-input-angles').value = '45,-45';
      document.getElementById('slv-input-material').value = 'CFRP_T700';
      document.getElementById('slv-input-pressure').value = 'external';
      document.getElementById('slv-input-end').value = 'simplySupported';
      document.getElementById('slv-input-axial').value = 'capped';
      document.getElementById('slv-input-pdesign').value = '2';
      // 隐藏自定义材料面板
      var cm = document.getElementById('custom-sleeve');
      if (cm) cm.style.display = 'none';
      break;

    case 'gfrp':
      // GFRP E-glass, [±45], 内压
      document.getElementById('slv-input-R').value = '40';
      document.getElementById('slv-input-L').value = '150';
      document.getElementById('slv-input-tply').value = '0.15';
      document.getElementById('slv-input-nlayers').value = '12';
      document.getElementById('slv-input-layup').value = 'AP45';
      document.getElementById('slv-input-angles').value = '45,-45';
      document.getElementById('slv-input-material').value = 'GFRP_Eglass';
      document.getElementById('slv-input-pressure').value = 'internal';
      document.getElementById('slv-input-end').value = 'clamped';
      document.getElementById('slv-input-axial').value = 'capped';
      document.getElementById('slv-input-pdesign').value = '2.5';
      var cm2 = document.getElementById('custom-sleeve');
      if (cm2) cm2.style.display = 'none';
      break;

    case 'thin':
      // 薄壁极限，[90]环向增强，很薄的壁厚
      document.getElementById('slv-input-R').value = '60';
      document.getElementById('slv-input-L').value = '250';
      document.getElementById('slv-input-tply').value = '0.1';
      document.getElementById('slv-input-nlayers').value = '8';
      document.getElementById('slv-input-layup').value = 'HOOP';
      document.getElementById('slv-input-angles').value = '90';
      document.getElementById('slv-input-material').value = 'CFRP_T700';
      document.getElementById('slv-input-pressure').value = 'external';
      document.getElementById('slv-input-end').value = 'simplySupported';
      document.getElementById('slv-input-axial').value = 'free';
      document.getElementById('slv-input-pdesign').value = '0.5';
      var cm3 = document.getElementById('custom-sleeve');
      if (cm3) cm3.style.display = 'none';
      break;
  }
  updateSleeveTotalThickness();
  calcSleeveUI();
}

// ---- 获取材料对象（处理自定义材料） ----
function getSleeveMaterial() {
  var matKey = document.getElementById('slv-input-material').value;
  if (matKey === 'custom') {
    return {
      name: '自定义材料',
      E1_GPa: readCustomVal('cs-E1') || 135,
      E2_GPa: readCustomVal('cs-E2') || 8.5,
      G12_GPa: readCustomVal('cs-G12') || 4.5,
      nu12: readCustomVal('cs-nu12') || 0.30,
      X_t_MPa: readCustomVal('cs-Xt') || 2100,
      X_c_MPa: readCustomVal('cs-Xc') || 1300,
      Y_t_MPa: readCustomVal('cs-Yt') || 50,
      Y_c_MPa: readCustomVal('cs-Yc') || 170,
      S_MPa: readCustomVal('cs-S') || 80
    };
  }
  return COMPOSITE_PRESETS[matKey] || COMPOSITE_PRESETS['CFRP_T700'];
}

// ---- 主计算函数 ----
function calcSleeveUI() {
  var R = parseFloat(document.getElementById('slv-input-R').value) || 0;
  var L = parseFloat(document.getElementById('slv-input-L').value) || 0;
  var tPly = parseFloat(document.getElementById('slv-input-tply').value) || 0;
  var nLayers = parseInt(document.getElementById('slv-input-nlayers').value) || 0;
  var anglesStr = document.getElementById('slv-input-angles').value.trim();
  var pressureDir = document.getElementById('slv-input-pressure').value;
  var endCond = document.getElementById('slv-input-end').value;
  var axialEnd = document.getElementById('slv-input-axial').value;
  var pDesign = parseFloat(document.getElementById('slv-input-pdesign').value) || 0;

  // 验证
  if (!R || !L || !tPly || !nLayers || !anglesStr) {
    alert('请填写所有必填参数（半径、长度、单层厚度、铺层数、铺层角度）');
    return;
  }

  // 解析铺层角度
  var plyAngles = anglesStr.split(',').map(function(s) {
    var v = parseFloat(s.trim());
    return isNaN(v) ? null : v;
  }).filter(function(v) { return v !== null; });

  if (plyAngles.length === 0) {
    alert('铺层角度格式错误，请使用逗号分隔的数字，如: 45,-45');
    return;
  }

  // 验证铺层数与角度匹配
  if (plyAngles.length === 2 && plyAngles[0] === -plyAngles[1] && nLayers % 2 !== 0) {
    alert('[±θ] 铺层需要偶数层数，请将铺层数调整为偶数');
    return;
  }

  var material = getSleeveMaterial();

  // 调用计算层
  var result;
  try {
    result = calcSleeveAll({
      R_mm: R, L_mm: L, t_ply_mm: tPly, n_layers: nLayers,
      plyAngles_deg: plyAngles,
      material: material,
      endCondition: endCond,
      pressureDir: pressureDir,
      axialEnd: axialEnd,
      p_design_MPa: pDesign,
      mapPoints: 25
    });
  } catch(e) {
    alert('计算出错: ' + e.message);
    console.error(e);
    return;
  }

  if (result.error) { alert(result.message); return; }
  renderSleeveResults(result);
  document.getElementById('results-sleeve').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- 结果渲染 ----
function renderSleeveResults(r) {
  var c = document.getElementById('results-sleeve');
  function sc(s) { return s === '合格' ? 'status-qualified' : (s === '警告' ? 'status-warning' : 'status-fail'); }

  var h = '';

  // ===== Card 1: 层合板参数 =====
  h += '<div class="section-card"><div class="section-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">' +
    '📐 层合板参数 — t=' + r.input.totalThickness_mm.toFixed(3) + 'mm, ' + r.input.n_layers + '层' +
    '<span style="font-size:0.75rem;color:var(--text-light)">▼</span></div><div class="section-body">';

  h += '<table class="param-table"><tr><th>参数</th><th>数值</th></tr>';
  h += '<tr><td>总壁厚</td><td><strong>' + r.input.totalThickness_mm.toFixed(3) + ' mm</strong></td></tr>';
  h += '<tr><td>单层厚度</td><td>' + r.input.t_ply_mm.toFixed(3) + ' mm</td></tr>';
  h += '<tr><td>铺层数</td><td>' + r.input.n_layers + '</td></tr>';
  h += '<tr><td>铺层序列</td><td style="font-family:var(--font-mono)">[' + r.input.plyAngles_deg.join('/') + ']</td></tr>';
  h += '<tr><td>材料</td><td>' + r.input.materialName + '</td></tr>';
  h += '<tr><td>R/t 比值</td><td>' + (r.input.R_mm / r.input.totalThickness_mm).toFixed(1) + '</td></tr>';
  h += '</table>';

  // ABD 矩阵摘要
  var eff = r.laminate.effectiveConstants;
  h += '<div style="margin-top:10px"><strong>等效工程常数:</strong></div>';
  h += '<table class="param-table"><tr><td>E_x (轴向)</td><td><strong>' + (eff.Ex_MPa/1000).toFixed(1) + ' GPa</strong></td>' +
    '<td>E_y (环向)</td><td><strong>' + (eff.Ey_MPa/1000).toFixed(1) + ' GPa</strong></td></tr>';
  h += '<tr><td>G_xy</td><td><strong>' + (eff.Gxy_MPa/1000).toFixed(1) + ' GPa</strong></td>' +
    '<td>ν_xy</td><td><strong>' + eff.nuxy.toFixed(3) + '</strong></td></tr>';
  h += '</table>';

  // 铺层 z 坐标表
  h += '<div style="margin-top:10px"><strong>铺层结构:</strong></div>';
  h += '<table class="ply-stress-table"><tr><th>层</th><th>角度</th><th>z_bottom</th><th>z_top</th></tr>';
  var zCoords = r.laminate.ABD.zCoords;
  for (var i = 0; i < zCoords.length; i++) {
    h += '<tr><td>' + zCoords[i].k + '</td><td>' + zCoords[i].angle_deg + '°</td>' +
      '<td>' + zCoords[i].z_bottom + '</td><td>' + zCoords[i].z_top + '</td></tr>';
  }
  h += '</table></div></div>';

  // ===== Card 2: 屈曲分析 =====
  h += '<div class="section-card"><div class="section-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">' +
    '📉 屈曲分析 (Vasiliev) — p<sub>cr</sub>=' + r.buckling.p_cr_MPa + ' MPa, n<sub>cr</sub>=' + r.buckling.n_cr +
    '<span style="font-size:0.75rem;color:var(--text-light)">▼</span></div><div class="section-body">';

  h += '<table class="param-table">';
  h += '<tr><td>临界屈曲压力</td><td style="font-family:var(--font-mono)"><strong>' + r.buckling.p_cr_MPa + ' MPa</strong></td></tr>';
  h += '<tr><td>屈曲折减后</td><td style="font-family:var(--font-mono);color:var(--accent)"><strong>' + r.buckling.p_cr_design_MPa + ' MPa</strong> (×' + r.buckling.knockdown + ')</td></tr>';
  h += '<tr><td>周向波数 n<sub>cr</sub></td><td><strong>' + r.buckling.n_cr + '</strong> 个全波</td></tr>';
  h += '<tr><td>轴向半波数 m</td><td>' + r.buckling.m_cr + '</td></tr>';
  h += '<tr><td>设计压力</td><td>' + r.input.p_design_MPa + ' MPa</td></tr>';
  h += '<tr><td>屈曲安全系数</td><td><span class="status-badge ' + sc(r.safetyFactors.buckling.qualified) + '">' +
    r.safetyFactors.buckling.SF + ' ' + r.safetyFactors.buckling.qualified + '</span></td></tr>';
  h += '</table>';

  // 各 n 扫描表
  h += '<div style="margin-top:8px"><strong>周向波数扫描:</strong></div>';
  var modes = r.buckling.allModes;
  h += '<div style="display:flex;flex-wrap:wrap;gap:3px;font-size:0.75rem;margin-top:4px">';
  for (var j = 0; j < Math.min(modes.length, 20); j++) {
    var isCrit = modes[j].n === r.buckling.n_cr;
    h += '<span style="padding:2px 6px;border-radius:3px;background:' + (isCrit ? '#fdebd0' : '#f5f6f8') +
      ';font-family:var(--font-mono)' + (isCrit ? ';font-weight:700;color:var(--accent)' : '') + '">' +
      'n=' + modes[j].n + ': ' + modes[j].p_cr_MPa.toFixed(2) + '</span>';
  }
  h += '</div>';

  h += '<div class="formula-block" style="margin-top:8px"><span class="formula-label">Vasiliev 公式:</span>' +
    'p<sub>cr</sub>(n) = (D₂₂/R³)(n²−1) + π⁴A₁₁R³/(L⁴·n⁴·(n²−1))<br>' +
    'D₂₂=' + r.laminate.ABD.stiffnessData.D22.toFixed(1) + ' N·mm, ' +
    'A₁₁=' + r.laminate.ABD.stiffnessData.A11.toFixed(0) + ' N/mm, ' +
    'R=' + r.input.R_mm + ' mm, L=' + r.input.L_mm + ' mm</div>';
  h += '</div></div>';

  // ===== Card 3: Tsai-Wu 材料失效 =====
  var mf = r.materialFailure;
  h += '<div class="section-card"><div class="section-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">' +
    '🧬 材料失效分析 (Tsai-Wu) — p<sub>fail</sub>=' + mf.p_fail_MPa + ' MPa, 关键层#' + mf.criticalPly +
    '<span style="font-size:0.75rem;color:var(--text-light)">▼</span></div><div class="section-body">';

  h += '<table class="param-table">';
  h += '<tr><td>失效压力</td><td style="font-family:var(--font-mono)"><strong>' + mf.p_fail_MPa + ' MPa</strong></td></tr>';
  h += '<tr><td>关键铺层</td><td><strong># ' + mf.criticalPly + '</strong> (' + mf.criticalAngle_deg + '°)</td></tr>';
  h += '<tr><td>失效模式</td><td style="color:var(--danger)"><strong>' + mf.failureMode + '</strong></td></tr>';
  h += '<tr><td>最大应力比</td><td>' + mf.maxStressRatio + '</td></tr>';
  h += '<tr><td>材料安全系数</td><td><span class="status-badge ' + sc(r.safetyFactors.material.qualified) + '">' +
    r.safetyFactors.material.SF + ' ' + r.safetyFactors.material.qualified + '</span></td></tr>';
  h += '</table>';

  // 逐层 TW 指数表
  var TW = r.materialFailure.plyResults;
  if (TW && TW.length > 0) {
    var maxTW_design = r.designCheck.maxTW_atDesign;
    h += '<div style="margin-top:10px"><strong>设计压力 ' + r.input.p_design_MPa + ' MPa 下的铺层应力:</strong></div>';
    h += '<table class="ply-stress-table"><tr><th>层</th><th>角</th><th>σ₁(MPa)</th><th>σ₂(MPa)</th><th>τ₁₂(MPa)</th><th>TW</th><th>状态</th></tr>';
    for (var k = 0; k < TW.length; k++) {
      var twRow = TW[k];
      var isCrit = (k + 1) === mf.criticalPly;
      h += '<tr' + (isCrit ? ' class="critical-row"' : '') + '>' +
        '<td>' + twRow.plyIndex + '</td><td>' + twRow.angle_deg + '°</td>' +
        '<td>' + twRow.sigma1_MPa + '</td><td>' + twRow.sigma2_MPa + '</td>' +
        '<td>' + twRow.tau12_MPa + '</td>' +
        '<td style="font-weight:600;color:' + (twRow.twIndex >= 1 ? 'var(--danger)' : 'inherit') + '">' + twRow.twIndex.toFixed(3) + '</td>' +
        '<td><span style="font-size:0.7rem;color:' + (twRow.twIndex >= 1 ? 'var(--danger)' : 'var(--success)') + '">' +
        (twRow.twIndex >= 1 ? '⚠失效' : '✓') + '</span></td></tr>';
    }
    h += '</table>';
    if (maxTW_design < 1) {
      h += '<div class="alert alert-success" style="margin-top:6px">✅ 设计压力下所有铺层 TW 指数 < 1，材料未失效</div>';
    } else {
      h += '<div class="alert alert-danger" style="margin-top:6px">⚠️ 设计压力下已有铺层 TW 指数 ≥ 1！</div>';
    }
  }
  h += '</div></div>';

  // ===== Card 4: 失效机制图 =====
  h += '<div class="section-card"><div class="section-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">' +
    '📈 失效机制图 — 壁厚 vs 失效压力曲线' +
    '<span style="font-size:0.75rem;color:var(--text-light)">▼</span></div><div class="section-body">';

  // 图例
  h += '<div class="map-legend">' +
    '<div class="map-legend-item"><span class="map-legend-swatch" style="background:#2980b9"></span> 屈曲失效 (Vasiliev)</div>' +
    '<div class="map-legend-item"><span class="map-legend-swatch" style="background:#e74c3c"></span> 材料失效 (Tsai-Wu)</div>' +
    '<div class="map-legend-item"><span class="map-legend-swatch" style="background:rgba(39,174,96,0.15);border-color:#27ae60"></span> 安全区</div>' +
    '<div class="map-legend-item"><span class="map-legend-swatch" style="background:rgba(243,156,18,0.15);border-color:#f39c12"></span> 过渡区</div>' +
    '<div class="map-legend-item"><span style="font-weight:700">●</span> 设计点</div>' +
    '</div>';

  // Canvas 容器
  h += '<div class="can-chart-container"><canvas id="failure-map-canvas" width="600" height="400"></canvas></div>';

  // 主导模式
  var isBucklingDominated = r.safetyFactors.buckling.SF < r.safetyFactors.material.SF;
  h += '<div style="text-align:center;margin-top:8px"><strong>主导失效模式: </strong>' +
    '<span class="failure-mode-tag ' + (isBucklingDominated ? 'buckling' : 'material') + '">' +
    r.governingMode + '</span></div>';

  // 底部计算信息
  h += '<div class="alert alert-info" style="margin-top:8px">' +
    '📐 壁厚扫描范围: ' + r.failureMap.tRange.min.toFixed(2) + ' ~ ' + r.failureMap.tRange.max.toFixed(2) +
    ' mm (' + r.failureMap.nPoints + ' 个数据点)<br>' +
    '💡 屈曲压力 ∝ t³ — 壁厚增加时屈曲抵抗力增长远快于材料强度 (∝ t)</div>';

  h += '</div></div>';

  // ===== Card 5: 计算详情（默认折叠） =====
  h += '<div class="section-card collapsed"><div class="section-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">' +
    '📝 中间计算详情 <span style="font-size:0.75rem;color:var(--text-light)">▶ 展开</span></div><div class="section-body" style="font-size:0.8rem">';

  // Q 矩阵
  var Qp = r.laminate.Qply;
  h += '<div class="formula-block"><span class="formula-label">① 单层折减刚度 Q (MPa)</span>' +
    'Q₁₁=' + Qp.Q11 + ', Q₂₂=' + Qp.Q22 + ', Q₁₂=' + Qp.Q12 + ', Q₆₆=' + Qp.Q66 +
    '<br>ν₂₁=' + Qp.nu21 + '</div>';

  // ABD 矩阵
  var ABD = r.laminate.ABD;
  h += '<div class="formula-block"><span class="formula-label">② A 矩阵 (N/mm)</span>' +
    'A₁₁=' + ABD.stiffnessData.A11 + ', A₂₂=' + ABD.stiffnessData.A22 +
    ', A₁₂=' + ABD.stiffnessData.A12 + ', A₆₆=' + ABD.stiffnessData.A66 + '</div>';
  h += '<div class="formula-block"><span class="formula-label">③ D 矩阵 (N·mm)</span>' +
    'D₁₁=' + ABD.stiffnessData.D11.toFixed(1) + ', D₂₂=' + ABD.stiffnessData.D22.toFixed(1) +
    ', D₁₂=' + ABD.stiffnessData.D12.toFixed(1) + ', D₆₆=' + ABD.stiffnessData.D66.toFixed(1) + '</div>';

  // 材料参数
  var mat = r.input.materialObj;
  h += '<div class="formula-block"><span class="formula-label">④ 材料强度 (MPa)</span>' +
    'X_t=' + mat.X_t_MPa + ', X_c=' + mat.X_c_MPa +
    ', Y_t=' + mat.Y_t_MPa + ', Y_c=' + mat.Y_c_MPa +
    ', S=' + mat.S_MPa + '<br>' +
    'F₁₂ 采用标准值 −½√(F₁₁·F₂₂)</div>';

  // 总结
  h += '<div class="formula-block"><span class="formula-label">⑤ 校核判定</span>' + r.summary + '</div>';
  h += '</div></div>';

  c.innerHTML = h;

  // 绘制失效机制图（延迟以确保 canvas 已渲染）
  setTimeout(function() {
    var canvas = document.getElementById('failure-map-canvas');
    if (canvas) {
      drawFailureMap(canvas, r.failureMap, r.failureMap.designPoint, r.input.p_design_MPa);
    }
  }, 50);
}

// ================================================================
// Canvas 图表: 失效机制图
// ================================================================

/**
 * 绘制壁厚 vs 失效压力的双重曲线图
 * 使用 Canvas 2D API（file:// 兼容，无需外部库）
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} mapData — { thicknesses[], buckling[], failure[], designPoint }
 * @param {object} dp — { t_mm, p_design_MPa, p_buckling_MPa, p_failure_MPa }
 * @param {number} pDesign — 设计压力
 */
function drawFailureMap(canvas, mapData, dp, pDesign) {
  var dpr = window.devicePixelRatio || 1;
  var W = 600, H = 400;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // 边距
  var margin = { top: 30, right: 30, bottom: 50, left: 60 };
  var pw = W - margin.left - margin.right;
  var ph = H - margin.top - margin.bottom;

  // 数据范围
  var ts = mapData.thicknesses;
  var bs = mapData.buckling;
  var fs = mapData.failure;

  // 过滤无效值
  var validB = [];
  var validF = [];
  var tMin = ts[0], tMax = ts[ts.length - 1];
  var pMax = 0;
  for (var i = 0; i < ts.length; i++) {
    if (isFinite(bs[i]) && bs[i] > 0) { validB.push({t: ts[i], p: bs[i]}); pMax = Math.max(pMax, bs[i]); }
    if (isFinite(fs[i]) && fs[i] > 0) { validF.push({t: ts[i], p: fs[i]}); pMax = Math.max(pMax, fs[i]); }
  }
  pMax = Math.max(pMax, pDesign * 1.5, dp.p_buckling_MPa || 0, dp.p_failure_MPa || 0);
  pMax = pMax * 1.15; // 留 15% 余量

  if (tMax <= tMin) tMax = tMin + 1;
  if (pMax <= 0) pMax = 10;

  function xScale(t) { return margin.left + (t - tMin) / (tMax - tMin) * pw; }
  function yScale(p) { return margin.top + ph - (p / pMax) * ph; }

  // 背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // ---- 分区着色 ----
  // 安全区 (绿色): 在两条曲线下方
  ctx.save();
  ctx.beginPath();
  // 下边界 = 沿 x 轴底部的线
  var startedPath = false;
  for (var i2 = 0; i2 < ts.length; i2++) {
    var px2 = xScale(ts[i2]);
    var isBSafe = isFinite(bs[i2]) && bs[i2] > 0;
    var isFSafe = isFinite(fs[i2]) && fs[i2] > 0;
    if (!isBSafe && !isFSafe) continue;
    var pSafe = isBSafe ? (isFSafe ? Math.min(bs[i2], fs[i2]) : bs[i2]) : fs[i2];
    if (!startedPath) { ctx.moveTo(px2, yScale(pSafe)); startedPath = true; }
    else { ctx.lineTo(px2, yScale(pSafe)); }
  }
  ctx.lineTo(xScale(tMax), yScale(0));
  ctx.lineTo(xScale(tMin), yScale(0));
  ctx.closePath();
  ctx.fillStyle = 'rgba(39, 174, 96, 0.12)';
  ctx.fill();
  ctx.restore();

  // 过渡区 (橙色): 在两条曲线之间
  ctx.save();
  ctx.beginPath();
  var startedB = false;
  for (var i3 = 0; i3 < ts.length; i3++) {
    var px3 = xScale(ts[i3]);
    var isB = isFinite(bs[i3]) && bs[i3] > 0;
    var isF = isFinite(fs[i3]) && fs[i3] > 0;
    if (!isB || !isF) continue;
    var pMin = Math.min(bs[i3], fs[i3]);
    var pMax2 = Math.max(bs[i3], fs[i3]);
    if (!startedB) {
      ctx.moveTo(px3, yScale(pMin));
      ctx.lineTo(px3, yScale(pMax2));
      startedB = true;
    } else {
      ctx.lineTo(px3, yScale(pMin));
      ctx.lineTo(px3, yScale(pMax2));
    }
  }
  // Close transition zone
  ctx.fillStyle = 'rgba(243, 156, 18, 0.08)';
  ctx.fill();
  ctx.restore();

  // ---- 网格线 ----
  ctx.strokeStyle = '#e8ecf2';
  ctx.lineWidth = 0.5;
  var nGridY = 6;
  for (var gy = 0; gy <= nGridY; gy++) {
    var py = margin.top + ph * gy / nGridY;
    ctx.beginPath();
    ctx.moveTo(margin.left, py);
    ctx.lineTo(margin.left + pw, py);
    ctx.stroke();
  }
  var nGridX = 6;
  for (var gx = 0; gx <= nGridX; gx++) {
    var pxx = margin.left + pw * gx / nGridX;
    ctx.beginPath();
    ctx.moveTo(pxx, margin.top);
    ctx.lineTo(pxx, margin.top + ph);
    ctx.stroke();
  }

  // ---- 坐标轴 ----
  ctx.strokeStyle = '#2c3e50';
  ctx.lineWidth = 1.5;
  // Y 轴
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + ph);
  ctx.stroke();
  // X 轴
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top + ph);
  ctx.lineTo(margin.left + pw, margin.top + ph);
  ctx.stroke();

  // ---- Y 轴标签 ----
  ctx.fillStyle = '#6b7c93';
  ctx.font = '10px ' + getComputedStyle(document.body).fontFamily;
  ctx.textAlign = 'right';
  for (var gy2 = 0; gy2 <= nGridY; gy2++) {
    var py2 = margin.top + ph * gy2 / nGridY;
    var pVal = pMax * (1 - gy2 / nGridY);
    ctx.fillText(pVal.toFixed(1), margin.left - 8, py2 + 3);
  }
  ctx.fillText('MPa', margin.left - 8, margin.top - 12);

  // ---- X 轴标签 ----
  ctx.textAlign = 'center';
  for (var gx2 = 0; gx2 <= nGridX; gx2++) {
    var pxx2 = margin.left + pw * gx2 / nGridX;
    var tVal = tMin + (tMax - tMin) * gx2 / nGridX;
    ctx.fillText(tVal.toFixed(1), pxx2, margin.top + ph + 16);
  }
  ctx.fillText('壁厚 t (mm)', margin.left + pw / 2, margin.top + ph + 36);

  // ---- 轴标题 ----
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2c3e50';
  ctx.font = 'bold 11px ' + getComputedStyle(document.body).fontFamily;
  ctx.fillText('失效机制图: 壁厚 — 临界压力', margin.left, margin.top - 8);

  // ---- 屈曲曲线 (蓝色) ----
  if (validB.length > 1) {
    ctx.strokeStyle = '#2980b9';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(xScale(validB[0].t), yScale(validB[0].p));
    for (var i4 = 1; i4 < validB.length; i4++) {
      ctx.lineTo(xScale(validB[i4].t), yScale(validB[i4].p));
    }
    ctx.stroke();
  }

  // ---- Tsai-Wu 曲线 (红色) ----
  if (validF.length > 1) {
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(xScale(validF[0].t), yScale(validF[0].p));
    for (var i5 = 1; i5 < validF.length; i5++) {
      ctx.lineTo(xScale(validF[i5].t), yScale(validF[i5].p));
    }
    ctx.stroke();
  }

  // ---- 设计点 ----
  if (dp.t_mm && dp.p_design_MPa) {
    // 十字参考线
    ctx.strokeStyle = '#7f8c8d';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xScale(dp.t_mm), margin.top);
    ctx.lineTo(xScale(dp.t_mm), margin.top + ph);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(margin.left, yScale(dp.p_design_MPa));
    ctx.lineTo(margin.left + pw, yScale(dp.p_design_MPa));
    ctx.stroke();
    ctx.setLineDash([]);

    // 大圆点
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.arc(xScale(dp.t_mm), yScale(dp.p_design_MPa), 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(xScale(dp.t_mm), yScale(dp.p_design_MPa), 3, 0, Math.PI * 2);
    ctx.fill();

    // 标注
    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 10px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'left';
    var labelX = xScale(dp.t_mm) + 10;
    var labelY = yScale(dp.p_design_MPa) - 10;
    ctx.fillText('设计点 t=' + dp.t_mm.toFixed(2) + 'mm', labelX, labelY);
    ctx.fillText('p=' + dp.p_design_MPa + 'MPa', labelX, labelY + 14);

    // 屈曲/失效标注
    ctx.fillStyle = '#2980b9';
    ctx.font = '9px ' + getComputedStyle(document.body).fontFamily;
    if (dp.p_buckling_MPa && isFinite(dp.p_buckling_MPa)) {
      ctx.fillText('屈曲: ' + dp.p_buckling_MPa.toFixed(1) + ' MPa', xScale(dp.t_mm) + 10, yScale(dp.p_buckling_MPa));
    }
    ctx.fillStyle = '#e74c3c';
    if (dp.p_failure_MPa && isFinite(dp.p_failure_MPa)) {
      ctx.fillText('材料: ' + dp.p_failure_MPa.toFixed(1) + ' MPa', xScale(dp.t_mm) + 10, yScale(dp.p_failure_MPa));
    }
  }
}

// ---- 重置 ----
function resetSleeve() {
  document.getElementById('slv-input-R').value = '50';
  document.getElementById('slv-input-L').value = '200';
  document.getElementById('slv-input-tply').value = '0.125';
  document.getElementById('slv-input-nlayers').value = '16';
  document.getElementById('slv-input-layup').value = 'AP45';
  document.getElementById('slv-input-angles').value = '45,-45';
  document.getElementById('slv-input-material').value = 'CFRP_T700';
  document.getElementById('slv-input-pressure').value = 'external';
  document.getElementById('slv-input-end').value = 'simplySupported';
  document.getElementById('slv-input-axial').value = 'capped';
  document.getElementById('slv-input-pdesign').value = '2';
  var cm = document.getElementById('custom-sleeve');
  if (cm) cm.style.display = 'none';
  updateSleeveTotalThickness();
  document.getElementById('results-sleeve').innerHTML =
    '<div class="empty-state"><div class="icon">🛡️</div>' +
    '<p>输入参数后点击 <strong>"开始分析"</strong></p>' +
    '<p style="font-size:0.8rem;margin-top:4px">基于 Vasiliev 屈曲理论 + Tsai-Wu 复合材料失效准则</p></div>';
}
