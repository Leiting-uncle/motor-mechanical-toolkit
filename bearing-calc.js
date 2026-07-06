/**
 * ============================================================
 * bearing-calc.js — 轴承校核核心计算层
 * 依据：SKF General Catalogue (滚动轴承)
 *       ISO 281:2007《滚动轴承 额定动载荷和额定寿命》
 *       GB/T 6391-2010 / GB/T 4662-2012
 *       NSK Super Precision Bearings Catalogue
 *       《机械设计手册》第五版 第2卷 (轴系力学)
 *
 * 职责：仅存放纯计算函数、校核逻辑
 * 禁止：任何 DOM 操作、界面交互代码
 *
 * 默认单位：长度 mm，力 N，应力/压强 MPa，
 *           力矩 N·mm，转矩 N·m，粘度 mm²/s (cSt)，
 *           温度 ℃，转速 rpm
 * 所有函数均为纯函数，相同输入永远得到相同输出
 * ============================================================
 */

// ============================================================
// 一、工具函数
// ============================================================

/**
 * 二维双线性插值
 * 依据：通用数值方法
 *
 * @param {number[][]} grid - 网格数据 grid[rowIdx][colIdx]
 * @param {number} x - 待查列值
 * @param {number} y - 待查行值
 * @param {number[]} xVals - 列值数组 (单调递增)
 * @param {number[]} yVals - 行值数组 (单调递增)
 * @returns {number} 插值结果
 */
function bilinearInterp(grid, x, y, xVals, yVals) {
  // Clamp to range
  x = Math.max(xVals[0], Math.min(x, xVals[xVals.length - 1]));
  y = Math.max(yVals[0], Math.min(y, yVals[yVals.length - 1]));

  // Find x bracket
  let xi = 0;
  while (xi < xVals.length - 1 && xVals[xi + 1] < x) xi++;
  if (xi >= xVals.length - 1) xi = xVals.length - 2;

  // Find y bracket
  let yi = 0;
  while (yi < yVals.length - 1 && yVals[yi + 1] < y) yi++;
  if (yi >= yVals.length - 1) yi = yVals.length - 2;

  // Four corner values
  const x0 = xVals[xi], x1 = xVals[xi + 1];
  const y0 = yVals[yi], y1 = yVals[yi + 1];
  const v00 = grid[yi][xi];
  const v01 = grid[yi + 1][xi];
  const v10 = grid[yi][xi + 1];
  const v11 = grid[yi + 1][xi + 1];

  // Bilinear weights
  const xd = (x - x0) / (x1 - x0);
  const yd = (y - y0) / (y1 - y0);

  const r0 = v00 * (1 - xd) + v10 * xd;
  const r1 = v01 * (1 - xd) + v11 * xd;

  return r0 * (1 - yd) + r1 * yd;
}

/**
 * 一维线性插值（用于查找表）
 * @param {number} x - 待查值
 * @param {number[]} xVals - 键值数组
 * @param {number[]} yVals - 值数组
 * @returns {number}
 */
function linearInterp(x, xVals, yVals) {
  if (x <= xVals[0]) return yVals[0];
  if (x >= xVals[xVals.length - 1]) return yVals[xVals.length - 1];

  let i = 0;
  while (i < xVals.length - 1 && xVals[i + 1] < x) i++;
  if (i >= xVals.length - 1) i = xVals.length - 2;

  const x0 = xVals[i], x1 = xVals[i + 1];
  const y0 = yVals[i], y1 = yVals[i + 1];
  const xd = (x - x0) / (x1 - x0);
  return y0 * (1 - xd) + y1 * xd;
}

/**
 * 工作粘度计算 — Walther方程
 * 依据：ASTM D341 标准粘温关系
 *
 * log(log(ν + 0.7)) = A - B · log(T + 273.15)
 * 其中 ν = 运动粘度 (mm²/s), T = 温度 (°C)
 *
 * @param {number} isoVG - ISO VG 粘度等级 (2,5,10,15,22,32,46,68,100,150,220,320,460,680)
 * @param {number} T_op - 工作温度 (°C)
 * @returns {{ nu_mm2s: number, formula: string, nu40: number }}
 */
function getOperatingViscosity(isoVG, T_op) {
  let vgData = ISO_VG_VISCOSITY[isoVG];
  if (!vgData) {
    // 最近ISO VG匹配
    const keys = Object.keys(ISO_VG_VISCOSITY).map(Number).sort((a,b) => a-b);
    let closest = keys[0];
    let minDiff = Math.abs(isoVG - closest);
    for (let i = 1; i < keys.length; i++) {
      const diff = Math.abs(isoVG - keys[i]);
      if (diff < minDiff) { minDiff = diff; closest = keys[i]; }
    }
    vgData = ISO_VG_VISCOSITY[closest];
  }

  const nu40 = vgData.nu40;
  // 估算 ν100：对于典型矿物油 (VI≈95)
  // log10(ν100) ≈ 0.7×log10(ν40) - 0.3 → ν100 ≈ 0.501 × ν40^0.7
  const nu100 = 0.501 * Math.pow(nu40, 0.7);

  // Walther 方程 (ASTM D341): log10(log10(ν+0.7)) = A - B×log10(T_K)
  const T1 = 40 + 273.15;   // 313.15 K
  const T2 = 100 + 273.15;  // 373.15 K

  const L1 = Math.log10(Math.log10(nu40 + 0.7));
  const L2 = Math.log10(Math.log10(nu100 + 0.7));

  const logT1 = Math.log10(T1);
  const logT2 = Math.log10(T2);

  const B = (L1 - L2) / (logT2 - logT1);
  const A = L1 + B * logT1;

  // 在工作温度 T_op 下计算粘度
  const T_abs = T_op + 273.15;
  const L = A - B * Math.log10(T_abs);
  const logNuP7 = Math.pow(10, L);
  let nu_mm2s = Math.pow(10, logNuP7) - 0.7;

  // 下限限制
  nu_mm2s = Math.max(0.5, nu_mm2s);

  return {
    nu_mm2s: nu_mm2s,
    nu40: nu40,
    A: Number(A.toFixed(4)),
    B: Number(B.toFixed(4)),
    formula: `ν(${T_op}°C) = 10^{10^{${A.toFixed(2)} - ${B.toFixed(2)}·log(${T_abs.toFixed(0)}K)}} - 0.7 = ${nu_mm2s.toFixed(2)} mm²/s`
  };
}

/**
 * 额定粘度 ν₁ 查询
 * 依据：SKF General Catalogue 图1
 *
 * @param {number} dm - 轴承平均直径 (d+D)/2, mm
 * @param {number} n_rpm - 转速, rpm
 * @returns {{ nu1_mm2s: number, dm: number, n: number, formula: string }}
 */
function getRatedViscosity(dm, n_rpm) {
  const table = RATED_VISCOSITY_TABLE;
  const nu1 = bilinearInterp(table.grid, n_rpm, dm, table.n_values, table.dm_values);

  return {
    nu1_mm2s: nu1,
    dm,
    n: n_rpm,
    formula: `ν₁(dm=${dm}mm, n=${n_rpm}rpm) = ${nu1.toFixed(1)} mm²/s (SKF图1 双线性内插)`
  };
}

/**
 * 粘度比 κ = ν / ν₁
 * @param {number} nu_mm2s - 工作粘度
 * @param {number} nu1_mm2s - 额定粘度
 * @returns {{ kappa: number, formula: string }}
 */
function calcViscosityRatio(nu_mm2s, nu1_mm2s) {
  const kappa = nu1_mm2s > 0 ? nu_mm2s / nu1_mm2s : 0.01;
  return {
    kappa,
    formula: `κ = ν / ν₁ = ${nu_mm2s.toFixed(2)} / ${nu1_mm2s.toFixed(1)} = ${kappa.toFixed(3)}`
  };
}

// ============================================================
// 二、轴承载荷系数 (X/Y) — GB/T 6391
// ============================================================

/**
 * 获取动态载荷系数 X, Y, e
 * 依据：GB/T 6391-2010 表2-5
 *
 * @param {string} bearingType - 轴承类型键
 * @param {number} Fa - 轴向载荷 (N)
 * @param {number} Fr - 径向载荷 (N)
 * @param {number} C0_kN - 基本额定静载荷 (kN)
 * @param {object} [extra] - 附加参数 { alpha, sub, e_manual }
 * @returns {{ X: number, Y: number, e: number, eTable, X1, Y1, X2, Y2, Fa_Fr: number, Fa_C0: number, compare: string, formula }}
 */
function getDynamicLoadFactors(bearingType, Fa, Fr, C0_kN, extra) {
  extra = extra || {};
  const typeData = BEARING_TYPES[bearingType];
  if (!typeData) {
    return { error: true, message: `未知轴承类型: ${bearingType}` };
  }

  const Fa_Fr = Fr > 0 ? Fa / Fr : 999;
  const Fa_C0 = C0_kN > 0 ? Fa / (C0_kN * 1000) : 0;

  let X, Y, e;

  // 按轴承类型处理
  switch (bearingType) {
    case 'deepGrooveBall': {
      // 从 eTable 内插 e 和 Y
      const et = typeData.eTable;
      let e_val, Y_val;

      // 找 Fa/C0 对应的 e 和 Y
      const FaC0_list = et.map(r => r.Fa_C0);
      e_val = linearInterp(Fa_C0, FaC0_list.map((v,i) => v), et.map(r => r.e));
      Y_val = linearInterp(Fa_C0, FaC0_list.map((v,i) => v), et.map(r => r.Y));

      e = e_val;
      if (Fa_Fr <= e) {
        X = typeData.X1;  // 1.0
        Y = typeData.Y1;  // 0
      } else {
        X = typeData.X2;  // 0.56
        Y = Y_val;
      }
      break;
    }

    case 'cylindricalRoller': {
      // 圆柱滚子：部分型号可有轴向力
      if (Fa > 0 && Fr > 0 && Fa / Fr <= 0.5) {
        e = 0.5;
        X = 0.5;
        Y = 0.6;  // typical for axial-capable cylindrical
      } else if (Fa === 0) {
        e = 0.2;
        X = 1.0;
        Y = 0;
      } else {
        e = 0.2;
        X = 1.0;
        Y = 0;   // pure radial
      }
      break;
    }

    case 'angularContactBall': {
      let series;
      if (extra.sub) {
        // Map sub values to series_xxx keys
        const subMap = {
          'series15': 'series_15deg', 'series_15': 'series_15deg', '15': 'series_15deg',
          'series25': 'series_25deg', 'series_25': 'series_25deg', '25': 'series_25deg',
          'series40': 'series_40deg', 'series_40': 'series_40deg', '40': 'series_40deg'
        };
        const key = subMap[extra.sub] || subMap['15'];
        series = typeData[key];
      } else if (extra.alpha) {
        const a = extra.alpha;
        if (a <= 18) series = typeData.series_15deg;
        else if (a <= 30) series = typeData.series_25deg;
        else series = typeData.series_40deg;
      } else {
        series = typeData.series_15deg;  // default
      }

      e = series.e;
      if (Fa_Fr <= e) {
        X = typeData.X1;  // 1.0
        Y = typeData.Y1;  // 0
      } else {
        X = series.X2;    // 0.44/0.41/0.35
        Y = series.Y2;    // from table
      }
      break;
    }

    case 'taperedRoller': {
      // e ≈ 1.5 * tan(α), 如果α已知
      if (extra.alpha) {
        const alpha_rad = extra.alpha * Math.PI / 180;
        e = 1.5 * Math.tan(alpha_rad);
      } else {
        e = 0.35;  // typical
      }
      // 圆锥滚子：计算因子 Y = 0.4 * cot(α)
      if (extra.alpha) {
        const alpha_rad = extra.alpha * Math.PI / 180;
        Y = 0.4 / Math.tan(alpha_rad);
      } else {
        Y = 1.6;  // typical
      }
      if (Fa_Fr <= e) {
        X = 1.0;
      } else {
        X = 0.4;
      }
      break;
    }

    case 'sphericalRoller': {
      e = 0.25; // typical, varies by series
      if (Fa_Fr <= e) {
        X = typeData.X1;  // 1.0
        Y = typeData.Y1;  // 2.5
      } else {
        X = typeData.X2;  // 0.67
        Y = 2.8;          // from table, can vary
      }
      break;
    }

    default:
      // Fallback for unknown types
      e = 0.3;
      X = Fa_Fr <= e ? 1.0 : 0.56;
      Y = Fa_Fr <= e ? 0 : 1.5;
  }

  const compare = Fa_Fr <= e
    ? `Fa/Fr = ${Fa_Fr.toFixed(3)} ≤ e = ${e.toFixed(3)} → 轴向力可忽略`
    : `Fa/Fr = ${Fa_Fr.toFixed(3)} > e = ${e.toFixed(3)} → 需计入轴向力`;

  return {
    X: Number(X.toFixed(4)),
    Y: Number(Y.toFixed(4)),
    e: Number(e.toFixed(4)),
    Fa_Fr: Number(Fa_Fr.toFixed(4)),
    Fa_C0: Number(Fa_C0.toFixed(6)),
    compare,
    formula: `Fa/C0=${Fa_C0.toFixed(4)} → e=${e.toFixed(3)}, Fa/Fr=${Fa_Fr.toFixed(3)} → X=${X}, Y=${Y}`
  };
}

/**
 * 获取静载荷系数 X0, Y0
 * 依据：GB/T 4662-2012
 *
 * @param {string} bearingType
 * @param {object} [extra] - { alpha, sub }
 * @returns {{ X0: number, Y0: number }}
 */
function getStaticLoadFactors(bearingType, extra) {
  extra = extra || {};
  const typeData = BEARING_TYPES[bearingType];
  if (!typeData) return { X0: 0.6, Y0: 0.5 };

  // 按类型返回
  switch (bearingType) {
    case 'angularContactBall': {
      let series;
      if (extra.sub) {
        const subMap = {
          'series15': 'series_15deg', 'series_15': 'series_15deg', '15': 'series_15deg',
          'series25': 'series_25deg', 'series_25': 'series_25deg', '25': 'series_25deg',
          'series40': 'series_40deg', 'series_40': 'series_40deg', '40': 'series_40deg'
        };
        const key = subMap[extra.sub] || subMap['15'];
        series = typeData[key];
      } else if (extra.alpha) {
        if (extra.alpha <= 18) series = typeData.series_15deg;
        else if (extra.alpha <= 30) series = typeData.series_25deg;
        else series = typeData.series_40deg;
      } else {
        series = typeData.series_15deg;
      }
      return { X0: series.X0, Y0: series.Y0 };
    }
    case 'taperedRoller':
      return { X0: typeData.X0, Y0: 0.5 };
    default:
      return { X0: typeData.X0 || 0.6, Y0: typeData.Y0 || 0.5 };
  }
}

// ============================================================
// 三、当量载荷计算
// ============================================================

/**
 * 当量动载荷 P 和当量静载荷 P0
 * 依据：ISO 281:2007
 *
 * @param {string} bearingType
 * @param {number} Fr - 径向载荷 (N)
 * @param {number} Fa - 轴向载荷 (N)
 * @param {number} C0_kN - 静载荷额定值 (kN)
 * @param {object} [extra] - 附加参数
 * @returns {{ P_N: number, P0_N: number, formula_P: string, formula_P0: string, factors: object }}
 */
function calcEquivalentLoad(bearingType, Fr, Fa, C0_kN, extra) {
  const dyn = getDynamicLoadFactors(bearingType, Fa, Fr, C0_kN, extra);
  if (dyn.error) return dyn;

  const sta = getStaticLoadFactors(bearingType, extra);

  // P = X·Fr + Y·Fa
  const P_N = dyn.X * Fr + dyn.Y * Fa;

  // 确保 P ≥ Fr (最小值规则: P ≥ Fr for deep groove, angular contact)
  // 圆柱滚子：P ≥ Fr
  let P_min = Fr;
  if (bearingType === 'cylindricalRoller') P_min = Fr;

  const P_final = Math.max(P_N, P_min);

  // 当量静载荷: P0 = max(X0·Fr + Y0·Fa, Fr) for most types
  const P0_calculated = sta.X0 * Fr + sta.Y0 * Fa;
  const P0_N = Math.max(P0_calculated, Fr);

  return {
    P_N: Number(P_final.toFixed(1)),
    P0_N: Number(P0_N.toFixed(1)),
    P_raw: Number(P_N.toFixed(1)),
    formula_P: `P = X·Fr + Y·Fa = ${dyn.X}×${Fr.toFixed(1)} + ${dyn.Y}×${Fa.toFixed(1)} = ${P_final.toFixed(1)} N${P_final > P_N ? ' (≥Fr)' : ''}`,
    formula_P0: `P₀ = max(${sta.X0}×${Fr.toFixed(1)} + ${sta.Y0}×${Fa.toFixed(1)}, Fr) = ${P0_N.toFixed(1)} N`,
    factors: {
      X: dyn.X, Y: dyn.Y, e: dyn.e,
      X0: sta.X0, Y0: sta.Y0,
      Fa_Fr: dyn.Fa_Fr, Fa_C0: dyn.Fa_C0,
      compare: dyn.compare
    }
  };
}

// ============================================================
// 四、基本额定寿命 — ISO 281:2007
// ============================================================

/**
 * 基本额定寿命 L10
 * 依据：ISO 281:2007 §4
 *
 * L10 = (C/P)^p × 10⁶ 转
 * L10h = (10⁶ / 60n) × L10 小时
 *
 * @param {number} C_kN - 基本额定动载荷 (kN)
 * @param {number} P_N - 当量动载荷 (N)
 * @param {number} n_rpm - 转速 (rpm)
 * @param {string} bearingType - 轴承类型 (决定 p)
 * @returns {{ L10_mr: number, L10h_hours: number, p: number, formula: string, C_kN, P_kN }}
 */
function calcBasicLife(C_kN, P_N, n_rpm, bearingType) {
  const typeData = BEARING_TYPES[bearingType];
  const p = (typeData && typeData.lifeExponent) ? typeData.lifeExponent : 3;
  const P_kN = P_N / 1000;

  // L10 百万转
  const L10_mr = Math.pow(C_kN / P_kN, p);

  // L10h 小时
  let L10h_hours;
  if (n_rpm > 0) {
    L10h_hours = (1000000 / (60 * n_rpm)) * L10_mr;
  } else {
    L10h_hours = Infinity;
  }

  return {
    C_kN,
    P_kN: Number(P_kN.toFixed(4)),
    P_N,
    p,
    L10_mr: Number(L10_mr.toFixed(2)),
    L10h_hours: isFinite(L10h_hours) ? Number(L10h_hours.toFixed(0)) : Infinity,
    formula: `L₁₀ = (C/P)^p = (${C_kN}/${P_kN.toFixed(3)})^${p === 3 ? 3 : '10/3'} = ${L10_mr.toFixed(1)}×10⁶ 转\nL₁₀h = 10⁶/(60×${n_rpm}) × ${L10_mr.toFixed(1)} = ${isFinite(L10h_hours) ? L10h_hours.toFixed(0) : '∞'} h`,
    lifeCategory: getLifeCategory(L10h_hours)
  };
}

/**
 * 寿命等级评定
 * @param {number} L10h - 额定寿命 (h)
 * @returns {string}
 */
function getLifeCategory(L10h) {
  if (!isFinite(L10h)) return '无限寿命（静止工况）';
  if (L10h >= 100000) return '超长寿命 (≥100,000h)';
  if (L10h >= 50000) return '优秀 (50,000-100,000h)';
  if (L10h >= 20000) return '良好 (20,000-50,000h)';
  if (L10h >= 10000) return '合格 (10,000-20,000h)';
  if (L10h >= 5000) return '偏低 (5,000-10,000h)';
  return '不足 (<5,000h)';
}

// ============================================================
// 五、SKF 修正额定寿命
// ============================================================

/**
 * SKF 寿命修正系数 aSKF
 * 依据：SKF General Catalogue §Selection of bearing size
 *
 * aSKF = f(κ, ηc·Pu/P)，通过二维插值查表
 *
 * @param {number} kappa - 粘度比 κ
 * @param {number} Pu_kN - 疲劳载荷极限 (kN)
 * @param {number} P_N - 当量动载荷 (N)
 * @param {number} eta_c - 污染系数
 * @param {string} family - 'ball' | 'roller'
 * @returns {{ aSKF: number, puP_eta: number, formula: string, note: string }}
 */
function calcSKFLifeFactor(kappa, Pu_kN, P_N, eta_c, family) {
  const P_kN = P_N / 1000;
  const puP = P_kN > 0 ? Pu_kN / P_kN : 10;
  const puP_eta = puP * eta_c;

  // 选取对应的 aSKF 表
  const table = (family === 'ball') ? aSKF_TABLE_BALL : aSKF_TABLE_ROLLER;

  // 夹持 κ 和 puP_eta 到表范围
  const kappaClamped = Math.max(table.kappa_values[0], Math.min(kappa, table.kappa_values[table.kappa_values.length - 1]));
  const puClamped = Math.max(table.pu_p_eta_values[0], Math.min(puP_eta, table.pu_p_eta_values[table.pu_p_eta_values.length - 1]));

  // 二维插值
  let aSKF = bilinearInterp(table.grid, puClamped, kappaClamped,
    table.pu_p_eta_values, table.kappa_values);

  // 上限为 50 (SKF 建议)
  aSKF = Math.min(aSKF, 50);

  let note = '';
  if (kappa < 0.1) note = 'κ<0.1 — 润滑严重不足，aSKF显著降低';
  else if (kappa < 0.4) note = '0.1≤κ<0.4 — 润滑不足';
  else if (kappa < 1.0) note = '0.4≤κ<1.0 — 边界润滑';
  else if (kappa < 2.0) note = '1.0≤κ<2.0 — 充分润滑';
  else if (kappa <= 4.0) note = '2.0≤κ≤4.0 — 极好润滑';
  else note = 'κ>4 — 取κ=4上限值';

  return {
    aSKF: Number(aSKF.toFixed(2)),
    puP: Number(puP.toFixed(4)),
    puP_eta: Number(puP_eta.toFixed(4)),
    kappa: Number(kappa.toFixed(3)),
    eta_c,
    formula: `ηc·Pu/P = ${eta_c} × ${puP.toFixed(3)} = ${puP_eta.toFixed(3)}, κ=${kappa.toFixed(3)} → aSKF = ${aSKF.toFixed(2)}`,
    note
  };
}

/**
 * 完整 SKF 修正额定寿命
 * 依据：ISO 281:2007 / SKF General Catalogue
 *
 * Lnm = a1 · aSKF · (C/P)^p × 10⁶ 转
 * Lnmh = (10⁶ / 60n) × Lnm 小时
 *
 * @param {object} p
 * @returns {{ Lnm_mr, Lnmh_hours, a1, aSKF, kappa, L10_mr, L10h_hours, summary }}
 */
function calcSKFModifiedLife(params) {
  const {
    C_kN, C0_kN, Pu_kN,           // 轴承额定值
    Fr_N, Fa_N, n_rpm,             // 载荷与转速
    bearingType,                   // 轴承类型键
    isoVG, T_op_C,                 // 润滑条件
    eta_c,                         // 污染系数
    reliability = 90,              // 可靠度 %
    extra = {}                     // 附加: alpha, sub
  } = params;

  // Step 1: 轴承类型数据
  const typeData = BEARING_TYPES[bearingType];
  if (!typeData) return { error: true, message: `未知轴承类型: ${bearingType}` };
  const family = typeData.family;

  // Step 2: dm 计算
  const d = params.d || 0;
  const _D = params.D || 0;
  const dm = params.Dpw || ((d + _D) / 2);

  // Step 3: 当量载荷
  const loadResult = calcEquivalentLoad(bearingType, Fr_N, Fa_N, C0_kN, extra);
  const { P_N, P0_N } = loadResult;

  // Step 4: 基本额定寿命
  const basicLife = calcBasicLife(C_kN, P_N, n_rpm, bearingType);

  // Step 5: 粘度
  const viscResult = getOperatingViscosity(isoVG, T_op_C);
  const nu1Result = getRatedViscosity(dm, n_rpm);
  const kappaResult = calcViscosityRatio(viscResult.nu_mm2s, nu1Result.nu1_mm2s);

  // Step 6: a1 可靠度系数
  const relData = RELIABILITY_FACTORS[String(reliability)] || RELIABILITY_FACTORS['90'];
  const a1 = relData.a1;

  // Step 7: aSKF
  const aSKFresult = calcSKFLifeFactor(kappaResult.kappa, Pu_kN, P_N, eta_c, family);

  // Step 8: Lnm, Lnmh
  const L10_mr = basicLife.L10_mr;
  const Lnm_mr = a1 * aSKFresult.aSKF * L10_mr;
  let Lnmh_hours;
  if (n_rpm > 0) {
    Lnmh_hours = (1000000 / (60 * n_rpm)) * Lnm_mr;
  } else {
    Lnmh_hours = Infinity;
  }

  return {
    // 基本寿命
    L10_mr: Number(L10_mr.toFixed(2)),
    L10h_hours: Number(basicLife.L10h_hours.toFixed(0)),
    lifeCategory: basicLife.lifeCategory,

    // 修正寿命
    Lnm_mr: Number(Lnm_mr.toFixed(2)),
    Lnmh_hours: isFinite(Lnmh_hours) ? Number(Lnmh_hours.toFixed(0)) : Infinity,
    lifeNmCategory: getLifeCategory(Lnmh_hours),

    // 系数
    a1,
    aSKF: aSKFresult.aSKF,
    p: basicLife.p,
    Lnm_label: relData.Lnm,

    // 载荷
    P_N: Number(P_N.toFixed(1)),
    P0_N: Number(P0_N.toFixed(1)),
    C_P_ratio: Number((C_kN * 1000 / P_N).toFixed(2)),
    C_kN: C_kN,
    load_factors: loadResult.factors,

    // 润滑
    kappa: Number(kappaResult.kappa.toFixed(3)),
    nu_mm2s: Number(viscResult.nu_mm2s.toFixed(2)),
    nu1_mm2s: Number(nu1Result.nu1_mm2s.toFixed(1)),
    nu40: viscResult.nu40,
    dm: Number(dm.toFixed(1)),

    // 中间过程（供追溯）
    _basicLife: basicLife,
    _viscResult: viscResult,
    _nu1Result: nu1Result,
    _aSKFresult: aSKFresult,

    // 汇总信息
    bearingType,
    bearingName: typeData.name,
    family,

    summary: `SKF修正额定寿命 ${relData.Lnm} = a₁·aSKF·L₁₀ = ${a1}×${aSKFresult.aSKF.toFixed(1)}×${L10_mr.toFixed(1)} = ${Lnm_mr.toFixed(1)}×10⁶转 = ${isFinite(Lnmh_hours) ? Lnmh_hours.toFixed(0) : '∞'}h`
  };
}

// ============================================================
// 六、静强度安全校核 — GB/T 4662
// ============================================================

/**
 * 静载安全系数
 * 依据：GB/T 4662-2012 / SKF General Catalogue
 *
 * s₀ = C₀ / P₀
 *
 * @param {number} C0_kN - 基本额定静载荷 (kN)
 * @param {number} P0_N - 当量静载荷 (N)
 * @param {string} applicationType - 工况类型键
 * @param {string} family - 'ball' | 'roller'
 * @returns {{ s0, minRequired, status, statusText, formula }}
 */
function checkStaticSafety(C0_kN, P0_N, applicationType, family) {
  const C0_N = C0_kN * 1000;
  const s0 = P0_N > 0 ? C0_N / P0_N : Infinity;

  // 获取最小要求
  const safetyData = MIN_STATIC_SAFETY[applicationType] || MIN_STATIC_SAFETY['normal'];
  let minRequired = safetyData.s0;

  // 球轴承可降低阈值（通常 0.5×滚子轴承值）
  if (family === 'ball') {
    minRequired = minRequired * MIN_STATIC_SAFETY.ballBearingAdjust;
  }

  let status, statusText;
  if (s0 >= minRequired * 1.5) {
    status = 'qualified';
    statusText = `安全裕度充分 (s₀=${s0.toFixed(1)} ≥ 1.5×${minRequired}=${(minRequired*1.5).toFixed(1)})`;
  } else if (s0 >= minRequired) {
    status = 'warning';
    statusText = `满足基本要求 (s₀=${s0.toFixed(1)} ≥ ${minRequired})`;
  } else {
    status = 'fail';
    statusText = `不满足静载要求 (s₀=${s0.toFixed(1)} < ${minRequired})`;
  }

  return {
    s0: isFinite(s0) ? Number(s0.toFixed(2)) : Infinity,
    C0_N: Number(C0_N.toFixed(0)),
    P0_N: Number(P0_N.toFixed(1)),
    minRequired,
    status,
    statusText,
    formula: `s₀ = C₀ / P₀ = ${C0_N.toFixed(0)} / ${P0_N.toFixed(1)} = ${isFinite(s0) ? s0.toFixed(2) : '∞'}`,
    applicationType: safetyData.name,
    adjustNote: (family === 'ball') ? `球轴承最小s₀=${safetyData.s0}×0.5=${minRequired.toFixed(2)}` : ''
  };
}

// ============================================================
// 七、摩擦功耗 — SKF 摩擦模型
// ============================================================

/**
 * 滚动轴承摩擦力矩和功率损失
 * 依据：SKF General Catalogue §Friction
 *
 * 总力矩 M = Mrr + Msl + Mseal + Mdrag
 * - Mrr: 滚动摩擦力矩
 * - Msl: 滑动摩擦力矩
 *
 * Mrr = φish · φrs · Grr · (ν·n)^0.6
 * Msl = Gsl · μsl
 *
 * 简化公式（无密封、油浴润滑）：
 * M ≈ 0.5·μ·P·d (经验公式，SKF 推荐用于快速估算)
 *
 * @param {object} params
 * @returns {{ Mrr_Nmm, Msl_Nmm, M_Nmm, P_loss_W, formula }}
 */
function calcFrictionMoment(params) {
  const {
    bearingType,
    dm,              // mean diameter mm
    Fr_N, Fa_N,      // loads N
    n_rpm,           // speed rpm
    nu_mm2s,         // operating viscosity mm²/s
    hasSeal = false,
    sealCount = 0
  } = params;

  const typeData = BEARING_TYPES[bearingType];
  if (!typeData) return { error: true, message: `未知轴承类型: ${bearingType}` };

  // Simplified SKF model coefficients
  // Grr and Gsl are bearing-specific — using representative values
  const Grr = typeData.frictionGrr_base || 0.5;
  const Gsl = typeData.frictionGsl_base || 1.5;

  // phi_ish (inlet shear heating reduction factor)
  // Simplified: for dm<100mm, phi_ish ≈ 1; drops off for larger diameters
  const phi_ish = dm <= 100 ? 1.0 : 1.0 / Math.pow(1 + 0.001 * (dm - 100), 0.6);

  // phi_rs (kinematic replenishment/starvation factor)
  // Simplified: for κ≥1, φrs≈1; for κ<1, decreases
  const kappa_est = params.kappa || 1.0;
  const phi_rs = kappa_est >= 1 ? 1.0 : 1 / Math.exp(0.3 / Math.max(kappa_est, 0.01) - 0.3);

  // Rolling friction moment Mrr [N·mm]
  const nu_n = nu_mm2s * n_rpm;
  const Mrr = phi_ish * phi_rs * Grr * Math.pow(Math.max(nu_n, 1), 0.6);

  // Sliding friction moment Msl [N·mm]
  // μsl ≈ 0.05 for full film, up to 0.15 for mixed
  const mu_sl = kappa_est >= 2 ? 0.04 : (kappa_est >= 1 ? 0.08 : 0.12);
  const Msl = Gsl * mu_sl;

  // Total moment
  const M_total = Mrr + Msl;

  // Power loss [W]
  const P_loss = M_total * n_rpm / 9550;

  return {
    Mrr_Nmm: Number(Mrr.toFixed(2)),
    Msl_Nmm: Number(Msl.toFixed(2)),
    M_total_Nmm: Number(M_total.toFixed(2)),
    P_loss_W: Number(P_loss.toFixed(2)),
    phi_ish: Number(phi_ish.toFixed(3)),
    phi_rs: Number(phi_rs.toFixed(3)),
    mu_sl: Number(mu_sl.toFixed(3)),
    Grr, Gsl,

    formula: `Mrr = φish·φrs·Grr·(ν·n)^0.6 = ${phi_ish.toFixed(2)}×${phi_rs.toFixed(2)}×${Grr}×(${nu_mm2s.toFixed(1)}×${n_rpm})^0.6 = ${Mrr.toFixed(1)} N·mm\n` +
      `Msl = Gsl·μsl = ${Gsl}×${mu_sl.toFixed(2)} = ${Msl.toFixed(1)} N·mm\n` +
      `M = Mrr + Msl = ${M_total.toFixed(1)} N·mm\n` +
      `P_loss = M·n/9550 = ${M_total.toFixed(1)}×${n_rpm}/9550 = ${P_loss.toFixed(2)} W`
  };
}

// ============================================================
// 八、极限转速校核
// ============================================================

/**
 * 热转速参考值校核
 * 依据：SKF General Catalogue §Speeds
 *
 * 简化模型：
 * - 脂润滑极限转速 ≈ 参考转速 × 修正系数
 * - 修正系数 = f(载荷比 P/C, 粘度比 κ, dm)
 *
 * @param {object} params
 * @returns {{ thermal_speed, status, note }}
 */
function checkSpeedRating(params) {
  const {
    n_rpm,
    speedGrease = 0,  // catalog grease speed limit rpm
    speedOil = 0,     // catalog oil speed limit rpm
    P_N, C_kN,
    dm,
    lubType = 'grease'
  } = params;

  const P_C = C_kN > 0 ? (P_N / 1000) / C_kN : 0;
  const refSpeed = lubType === 'grease' ? speedGrease : speedOil;

  // 载荷修正系数
  let loadFactor;
  if (P_C <= 0.04) loadFactor = 1.0;
  else if (P_C <= 0.08) loadFactor = 0.9;
  else if (P_C <= 0.12) loadFactor = 0.7;
  else loadFactor = 0.5;

  // 尺寸修正 (dm)
  let sizeFactor;
  if (dm <= 50) sizeFactor = 1.0;
  else if (dm <= 100) sizeFactor = 0.9;
  else if (dm <= 200) sizeFactor = 0.7;
  else sizeFactor = 0.5;

  const adjustedSpeed = refSpeed * loadFactor * sizeFactor;
  const ratio = refSpeed > 0 ? n_rpm / adjustedSpeed : 0;

  let status;
  if (ratio <= 0.8) status = 'qualified';
  else if (ratio <= 1.0) status = 'warning';
  else status = 'fail';

  return {
    refSpeed_rpm: refSpeed,
    adjustedSpeed_rpm: Number(adjustedSpeed.toFixed(0)),
    loadFactor: Number(loadFactor.toFixed(2)),
    sizeFactor: Number(sizeFactor.toFixed(2)),
    n_rpm,
    ratio: Number(ratio.toFixed(2)),
    status,
    statusText: ratio <= 0.8 ? '转速在安全范围内' :
                ratio <= 1.0 ? '转速接近极限，注意温升' :
                '转速超过参考极限，需采取特殊措施（油-气润滑等）',
    formula: `n@limit = n@ref × f_load × f_size = ${refSpeed} × ${loadFactor.toFixed(2)} × ${sizeFactor.toFixed(2)} = ${adjustedSpeed.toFixed(0)} rpm\n运行转速/极限转速 = ${n_rpm}/${adjustedSpeed.toFixed(0)} = ${ratio.toFixed(2)}`
  };
}

// ============================================================
// 九、配合推荐
// ============================================================

/**
 * 轴承配合推荐
 * 依据：SKF General Catalogue §Fits
 *
 * @param {string} loadCondition - 'rotatingIR' | 'stationaryIR'
 * @param {number} d - 内径 mm
 * @param {number} D - 外径 mm
 * @param {number} P_N - 当量动载荷 N
 * @param {number} C_kN - 额定动载荷 kN
 * @returns {{ shaftFit, housingFit, shaftDesc, housingDesc }}
 */
function getRecommendedFits(loadCondition, d, D, P_N, C_kN) {
  const P_C = C_kN > 0 ? (P_N / 1000) / C_kN : 0;

  // 内圈旋转 → 轴过盈，座孔间隙
  // 外圈旋转 → 轴间隙，座孔过盈

  let loadCategory;
  if (P_C <= 0.06) loadCategory = '轻载 (P/C ≤ 0.06)';
  else if (P_C <= 0.12) loadCategory = '正常载荷 (0.06 < P/C ≤ 0.12)';
  else loadCategory = '重载 (P/C > 0.12)';

  // 轴配合
  const shaftIdx = P_C <= 0.06 ? 0 : (P_C <= 0.12 ? 1 : 2);
  const shaftRec = BEARING_FIT_RECOMMENDATIONS.shaft[shaftIdx];
  const housingIdx = P_C <= 0.06 ? 0 : (P_C <= 0.12 ? 1 : 2);
  const housingRec = BEARING_FIT_RECOMMENDATIONS.housing[housingIdx];

  // 考虑内径 d 的影响
  let shaftFit = shaftRec.fit;
  if (d <= 17 && P_C <= 0.06) shaftFit = 'j5';  // 小轴径用更精密公差
  else if (d >= 100) shaftFit = shaftRec.fit.replace('6', '6'); // 大直径保持

  return {
    loadCategory,
    P_C: Number(P_C.toFixed(4)),
    shaftFit,
    shaftDesc: shaftRec.toleranceDesc,
    shaftFitFull: `${d}${shaftFit}`,
    housingFit: housingRec.fit,
    housingDesc: housingRec.toleranceDesc,
    housingFitFull: `${D}${housingRec.fit}`,
    formula: loadCondition === 'rotatingIR'
      ? `内圈旋转: P/C=${P_C.toFixed(3)} → ${loadCategory}\n轴: ${shaftFit} (${shaftRec.toleranceDesc})\n座孔: ${housingRec.fit} (${housingRec.toleranceDesc})`
      : `外圈旋转: 座孔过盈配合，轴间隙配合`
  };
}

// ============================================================
// 十、游隙推荐
// ============================================================

/**
 * 内部游隙等级推荐
 * 依据：SKF General Catalogue §Internal clearance
 *
 * 考虑因素:
 * 1. 配合过盈量 → 游隙减小
 * 2. 内外圈温差 → 游隙减小 [ΔC = α·dm·ΔT]
 * 3. 转速 → 需要稍大游隙
 *
 * @param {number} d - 内径 mm
 * @param {number} D - 外径 mm
 * @param {number} deltaT_C - 内外圈温差 (内圈温度-外圈温度) °C, 典型电机 5-15°C
 * @param {number} n_rpm - 转速 rpm
 * @returns {{ grade, name, condition, note }}
 */
function getClearanceRecommendation(d, D, deltaT_C, n_rpm) {
  const dm = (d + D) / 2;

  // 简化判断逻辑
  let score = 0;
  let reasons = [];

  // 温差影响：10°C以上需要C3
  if (deltaT_C > 10) { score += 2; reasons.push(`内外圈温差 ${deltaT_C}°C`); }
  else if (deltaT_C > 5) { score += 1; reasons.push(`内外圈温差 ${deltaT_C}°C`); }

  // 转速影响 (dm·n)
  const dm_n = dm * n_rpm / 10000;  // 10⁴ mm·rpm
  if (dm_n > 50) { score += 2; reasons.push(`高速 (dm·n = ${(dm_n*10000).toFixed(0)} mm·rpm)`); }
  else if (dm_n > 20) { score += 1; reasons.push(`中高速 (dm·n = ${(dm_n*10000).toFixed(0)} mm·rpm)`); }

  // 轴径影响
  if (d > 60) { score += 1; reasons.push(`大轴径 d=${d}mm`); }

  // 判定
  let grade;
  if (score <= 0) grade = CLEARANCE_RECOMMENDATIONS[1];  // CN
  else if (score <= 2) grade = CLEARANCE_RECOMMENDATIONS[2];  // C3
  else if (score <= 4) grade = CLEARANCE_RECOMMENDATIONS[3];  // C4
  else grade = CLEARANCE_RECOMMENDATIONS[4];  // C5

  return {
    grade: grade.grade,
    name: grade.name,
    condition: grade.condition,
    score,
    reasons: reasons.length > 0 ? reasons.join('; ') : '标准条件',
    note: dm_n > 80
      ? '⚠ d_m·n > 800,000 — 建议确认游隙余量，高速工况可能需C4或以上'
      : ''
  };
}

// ============================================================
// 十一、再润滑周期
// ============================================================

/**
 * 脂润滑再润滑间隔和注脂量
 * 依据：SKF General Catalogue §Relubrication
 *
 * 简化公式: t_f = K_f × [14,000,000 / (n × √d_m) - 4 × d_m]​
 *
 * K_f 系数:
 * - 深沟球/角接触球: 1.0
 * - 圆柱/圆锥滚子: 0.5
 * - 调心滚子: 0.3
 * - 推力轴承: 0.1
 *
 * @param {number} n_rpm - 转速
 * @param {number} dm - 平均直径 mm
 * @param {string} bearingType - 轴承类型键
 * @param {number} temp_C - 工作温度
 * @returns {{ interval_h: number, grease_qty_g: number, method }}
 */
function calcRelubrication(n_rpm, dm, bearingType, temp_C) {
  // K_f by bearing type
  const kFactors = {
    deepGrooveBall: 1.0,
    angularContactBall: 0.8,
    cylindricalRoller: 0.5,
    taperedRoller: 0.5,
    sphericalRoller: 0.3
  };
  const K_f = kFactors[bearingType] || 0.5;

  // 温度修正：高于70°C减半，高于90°C再减半
  let tempFactor = 1.0;
  if (temp_C > 90) tempFactor = 0.25;
  else if (temp_C > 70) tempFactor = 0.5;

  // 基础再润滑间隔
  const term1 = 14000000 / (n_rpm * Math.sqrt(dm));
  const term2 = 4 * dm;
  const t_f_raw = K_f * (term1 - term2);
  const t_f = Math.max(t_f_raw * tempFactor, 0);

  // 注脂量 (g) ≈ 0.005 × D × B (外径×宽度)
  // 简化: G = 0.005 * D * B or estimated from dm
  const greaseQty = Math.max(1, 0.005 * dm * 16); // approx with B≈16 typical

  // 判定
  let status, method;
  const t_f_hours = t_f;
  if (t_f_hours <= 0) {
    status = 'fail';
    method = '再润滑间隔为0/负值 — 转速过高或轴承过大。建议：油润滑或减少再润滑周期到<1000h';
  } else if (t_f_hours < 2000) {
    status = 'warning';
    method = `再润滑周期较短 (${t_f_hours.toFixed(0)}h)，建议自动注脂系统或油-气润滑`;
  } else if (t_f_hours < 4000) {
    status = 'qualified';
    method = `每 ${t_f_hours.toFixed(0)}h 手动注脂`;
  } else {
    status = 'qualified';
    method = t_f_hours > 10000
      ? `可延长至 ${t_f_hours.toFixed(0)}h (>10,000h 建议密封深沟球免维护)`
      : `每 ${t_f_hours.toFixed(0)}h 手动注脂`;
  }

  return {
    interval_h_raw: Number(t_f_raw.toFixed(0)),
    interval_h: Number(t_f.toFixed(0)),
    grease_qty_g: Number(greaseQty.toFixed(1)),
    K_f, tempFactor,
    status,
    method,
    formula: `t_f = K_f × [14,000,000/(n·√d_m) - 4·d_m]\n= ${K_f} × [14,000,000/(${n_rpm}×${Math.sqrt(dm).toFixed(1)}) - ${(4*dm).toFixed(0)}] = ${t_f_raw.toFixed(0)} h\n温度修正 (${temp_C}°C): ×${tempFactor} → ${t_f.toFixed(0)} h`
  };
}

// ============================================================
// 十二、NSK 高速轴承计算
// 依据：NSK Super Precision Bearings Catalogue
// ============================================================

/**
 * NSK 预紧力与刚度计算
 *
 * 预紧力 F_pre ≈ ratio × C0（近似）
 * 轴向刚度 k_a ≈ k0 × F_pre^n (n≈0.5 for angular contact ball)
 * 径向刚度 k_r ≈ k_a × 2.0（角接触球轴承）
 *
 * @param {object} params
 * @returns {{ F_pre_N, k_axial_N_um, k_radial_N_um, formula }}
 */
function calcNSKPreloadStiffness(params) {
  const {
    bearingType,
    d, D, Dw, Z, alpha = 15,  // 轴承几何
    C0_kN = 0,               // 额定静载 kN
    preloadLevel = 'L',      // EL/L/M/H/custom
    customForce_N = 0        // 自定义预紧力 (N)
  } = params;

  // 预紧力
  let F_pre_N;
  let preloadDesc;
  if (preloadLevel === 'custom' && customForce_N > 0) {
    F_pre_N = customForce_N;
    preloadDesc = `自定义 (${customForce_N} N)`;
  } else {
    const preloadData = NSK_DATA.preload[preloadLevel] || NSK_DATA.preload['L'];
    const C0_N = C0_kN * 1000;
    F_pre_N = preloadData.forceRatio * C0_N;
    preloadDesc = preloadData.name;

    if (C0_N <= 0) {
      // 无 C0 时按公式估算：F_pre ≈ k_pre · Z · Dw² (N)
      // k_pre: 0.02(EL) 0.05(L) 0.1(M) 0.2(H)
      const kMap = { EL: 0.02, L: 0.05, M: 0.1, H: 0.2 };
      const k = kMap[preloadLevel] || 0.05;
      F_pre_N = k * Z * Dw * Dw;
      preloadDesc = preloadData.name + ' (估算)';
    }
  }

  // 轴向刚度 (NSK 经验公式)
  // k_a ≈ k0 × √(F_pre × Z² × Dw) / α_correction
  const alpha_rad = alpha * Math.PI / 180;
  const alphaFactor = Math.pow(Math.sin(alpha_rad), 2.0/3.0);
  // Simplified formula adapted from NSK catalog
  const k0 = NSK_DATA.stiffnessRef.coeffA;
  const k_axial_N_um = k0 * Math.pow(F_pre_N, NSK_DATA.stiffnessRef.expA) / 1000;

  // 径向刚度 (角接触球轴承 k_r ≈ 2·k_a)
  const k_radial_N_um = k_axial_N_um * NSK_DATA.stiffnessRef.radialAxialRatio;

  return {
    F_pre_N: Number(F_pre_N.toFixed(1)),
    preloadDesc,
    k_axial_N_um: Number(k_axial_N_um.toFixed(1)),
    k_radial_N_um: Number(k_radial_N_um.toFixed(1)),
    formula: `F_pre = ${preloadDesc}, preloadForceRatio × C₀ = ${F_pre_N.toFixed(1)} N\n` +
      `k_a ≈ ${k0} × F_pre^${NSK_DATA.stiffnessRef.expA} ≈ ${k_axial_N_um.toFixed(1)} N/μm\n` +
      `k_r ≈ k_a × ${NSK_DATA.stiffnessRef.radialAxialRatio} ≈ ${k_radial_N_um.toFixed(1)} N/μm`
  };
}

/**
 * NSK 极限转速计算
 * 考虑：保持架类型、球材料、精度等级、预紧水平的修正
 *
 * @param {object} params
 * @returns {{ n_limit_grease, n_limit_oil, dm_n_value, status }}
 */
function calcNSKSpeedLimits(params) {
  const {
    d, D,
    n_ref_grease = 0,    // 脂润滑参考极限转速 rpm
    n_ref_oil = 0,       // 油润滑参考极限转速 rpm
    cageType = 'phenolic',
    ballMaterial = 'steel',
    precision = 'P5',
    preloadLevel = 'L',
    n_rpm = 0            // 运行转速
  } = params;

  const dm = (d + D) / 2;

  // 各修正系数
  const cageFactor = (NSK_DATA.cageFactors[cageType] || { factor: 1.0 }).factor;
  const ballFactor = (NSK_DATA.ballMaterial[ballMaterial] || { factor: 1.0 }).factor;
  const precFactor = (NSK_DATA.precisionFactors[precision] || { factor: 1.0 }).factor;

  // 预紧降速系数: EL→1.0, L→0.9, M→0.8, H→0.7
  const preloadSpeedFactor = { EL: 1.0, L: 0.9, M: 0.8, H: 0.7, custom: 0.9 };
  const pFactor = preloadSpeedFactor[preloadLevel] || 0.9;

  const totalFactor = cageFactor * ballFactor * precFactor * pFactor;

  const n_limit_grease = n_ref_grease * totalFactor;
  const n_limit_oil = n_ref_oil * totalFactor;
  const dm_n_value = dm * n_rpm;

  // dm·n 基准: 钢球 ~1.0×10⁶, 陶瓷球 ~1.6×10⁶, 油-气 ~2.5×10⁶
  let dm_n_limit;
  if (ballMaterial === 'ceramic') dm_n_limit = 1600000;
  else dm_n_limit = 1000000;

  const status = dm_n_value <= dm_n_limit * 0.8 ? 'qualified' :
                 dm_n_value <= dm_n_limit ? 'warning' : 'fail';

  return {
    dm,
    n_limit_grease: Number(n_limit_grease.toFixed(0)),
    n_limit_oil: Number(n_limit_oil.toFixed(0)),
    dm_n_value: Number(dm_n_value.toFixed(0)),
    dm_n_limit,
    cageFactor, ballFactor, precFactor, preloadSpeedFactor: pFactor,
    totalFactor: Number(totalFactor.toFixed(3)),
    status,
    statusText: status === 'qualified' ? `dm·n = ${dm_n_value.toFixed(0)} < 0.8×${dm_n_limit} — 安全` :
                status === 'warning' ? `dm·n = ${dm_n_value.toFixed(0)} < ${dm_n_limit} — 接近极限` :
                `dm·n = ${dm_n_value.toFixed(0)} > ${dm_n_limit} — 超限`,
    formula: `n_limit = n_ref × f_cage × f_ball × f_prec × f_preload\n= ${n_ref_grease} × ${cageFactor} × ${ballFactor} × ${precFactor} × ${pFactor} = ${n_limit_grease.toFixed(0)} rpm (脂)\ndm·n = ${dm.toFixed(0)} × ${n_rpm} = ${dm_n_value.toFixed(0)} mm·rpm`
  };
}

/**
 * NSK 隔圈长度差建议
 * DB 排列：内隔圈比外隔圈略长 → 安装后产生预紧
 * ΔL = f(F_pre, dm)
 *
 * @param {number} F_pre_N - 预紧力 N
 * @param {number} dm - 平均直径 mm
 * @returns {{ deltaL_mm, min_mm, max_mm }}
 */
function calcNSKSpacerDelta(F_pre_N, dm) {
  // ΔL 与预紧力和dm成正比
  const deltaL_ref = NSK_DATA.spacerRule.deltaL_typical;
  const F_ratio = F_pre_N / 200;  // 200N = typical L preload
  const dm_ratio = dm / 50;       // 50mm = typical medium bearing

  // 经验公式: ΔL ≈ 0.06 × (F_pre/200)^0.5 × (dm/50)^0.3
  const deltaL = deltaL_ref * Math.pow(F_ratio, 0.5) * Math.pow(dm_ratio, 0.3);
  const min = NSK_DATA.spacerRule.deltaL_min_mm;
  const max = NSK_DATA.spacerRule.deltaL_max_mm;

  return {
    deltaL_mm: Number(Math.max(min, Math.min(max, deltaL)).toFixed(3)),
    min_mm: min,
    max_mm: max,
    deltaL_ref,
    formula: `ΔL = ${deltaL_ref.toFixed(2)} × (F_pre/200)^{0.5} × (dm/50)^{0.3} = ${deltaL.toFixed(3)} mm → 取 ${Math.max(min, Math.min(max, deltaL)).toFixed(3)} mm (夹持 ${min.toFixed(2)}-${max.toFixed(2)})`
  };
}

/**
 * NSK 高速轴承主计算
 *
 * @param {object} p
 * @returns {{ stiffness, speed, spacer, life }}
 */
function calcBearingNSK(p) {
  const {
    bearingType = 'angularContactBall',
    d, D, Dw, Z, alpha, C0_kN,
    n_rpm, Fr_N, Fa_N,
    preloadLevel = 'L', customForce_N = 0,
    cageType = 'phenolic',
    ballMaterial = 'steel',
    precision = 'P5',
    arrangement = 'DB',
    speedGrease = 0, speedOil = 0,
    C_kN = 0, Pu_kN = 0,
    isoVG = 68, T_op_C = 40, eta_c = 0.5,
    reliability = 95
  } = p;

  // 1. 预紧与刚度
  const stiffness = calcNSKPreloadStiffness({
    bearingType, d, D, Dw, Z, alpha, C0_kN,
    preloadLevel, customForce_N
  });

  // 2. 极限转速
  const speedResult = calcNSKSpeedLimits({
    d, D, n_ref_grease: speedGrease, n_ref_oil: speedOil,
    cageType, ballMaterial, precision, preloadLevel, n_rpm
  });

  // 3. 隔圈
  const spacer = calcNSKSpacerDelta(stiffness.F_pre_N, speedResult.dm);

  // 4. NSK 高速寿命 (近似用 SKF 方法，但用 NSK 特有的修正)
  // NSK 高速轴承寿命通常比 SKF 基本寿命更好（因为更好的材质和加工）
  // 这里计算基本寿命并给出 NSK 特有的修正说明
  const lifeResult = calcSKFModifiedLife({
    C_kN, C0_kN, Pu_kN, Fr_N, Fa_N, n_rpm,
    bearingType, isoVG, T_op_C, eta_c, reliability,
    d, D, extra: { alpha }
  });

  // 陶瓷球额外寿命修正
  const ceramicLifeFactor = ballMaterial === 'ceramic' ? 1.5 : 1.0;
  const nskAdjustedLife = lifeResult.Lnmh_hours * ceramicLifeFactor;

  return {
    stiffness,
    speed: speedResult,
    spacer,
    arrangement: NSK_DATA.arrangements[arrangement],
    preload: NSK_DATA.preload[preloadLevel],
    life: {
      L10h_hours: lifeResult.L10h_hours,
      Lnmh_hours: isFinite(lifeResult.Lnmh_hours) ? lifeResult.Lnmh_hours : Infinity,
      nskAdjustedLnmh: isFinite(nskAdjustedLife) ? Number(nskAdjustedLife.toFixed(0)) : Infinity,
      ceramicLifeFactor,
      a1: lifeResult.a1,
      aSKF: lifeResult.aSKF,
      kappa: lifeResult.kappa,
      P_N: lifeResult.P_N,
      note: ballMaterial === 'ceramic'
        ? `陶瓷球轴承寿命修正：×${ceramicLifeFactor}（NSK推荐，陶瓷球降低接触应力）`
        : ''
    },
    precision: NSK_DATA.precisionFactors[precision],
    ballMaterial: NSK_DATA.ballMaterial[ballMaterial],
    cageType: NSK_DATA.cageFactors[cageType],
    summary: `NSK高速轴承：${stiffness.preloadDesc}, k_r=${stiffness.k_radial_N_um} N/μm, ` +
      `极限转速=${speedResult.n_limit_grease} rpm (脂), dm·n=${speedResult.dm_n_value} mm·rpm`
  };
}

// ============================================================
// 十三、轴系力学
// 依据：《机械设计手册》第五版 第2卷
// ============================================================

/**
 * 轴的截面惯性矩
 * @param {number} d - 轴径 mm
 * @returns {{ I_mm4, J_mm4, W_mm3 }} I=πd⁴/64, J=πd⁴/32, W=πd³/32
 */
function shaftSectionProps(d) {
  const d2 = d * d;
  const d3 = d2 * d;
  const d4 = d2 * d2;
  return {
    I_mm4: Math.PI * d4 / 64,
    J_mm4: Math.PI * d4 / 32,
    W_mm3: Math.PI * d3 / 32
  };
}

/**
 * 轴系弯曲临界转速 — Rayleigh方法
 * 依据：机械设计手册 第2卷 §19-107
 *
 * 两轴承弹性支承 + 集中质量
 * 假设：转子质量集中在轴中点
 *
 * ω_cr = √(g × Σ(m_i × y_i) / Σ(m_i × y_i²))
 *
 * @param {object} p
 * @param {number} p.k1_N_um - 轴承1径向刚度 N/μm
 * @param {number} p.k2_N_um - 轴承2径向刚度 N/μm
 * @param {number} p.L_mm - 轴承跨距 mm
 * @param {number} p.d_shaft - 轴径 mm (简化: 等直径轴)
 * @param {number} p.m_rotor_kg - 转子质量 kg
 * @param {string} p.shaftMaterial - 轴材料键
 * @param {number} [p.L_overhang1] - 悬臂段1 mm
 * @param {number} [p.L_overhang2] - 悬臂段2 mm
 * @returns {{ n_crit_rpm, omega_n_rads, f_hz, deflection_um, safety_ratio, warnings }}
 */
function calcShaftCriticalSpeed(p) {
  const {
    k1_N_um = 100,       // 轴承1径向刚度 N/μm
    k2_N_um = 100,       // 轴承2径向刚度 N/μm
    L_mm = 300,          // 轴承跨距
    d_shaft = 40,        // 轴径
    m_rotor_kg = 20,     // 转子质量
    shaftMaterial = '45钢',
    n_rpm = 3000         // 运行转速 (for safety ratio)
  } = p;

  const mat = SHAFT_MATERIALS[shaftMaterial] || SHAFT_MATERIALS['45钢'];
  const E = mat.E_MPa * 1e6;  // Pa (N/m²)

  // 截面属性
  const props = shaftSectionProps(d_shaft);
  const I = props.I_mm4 * 1e-12;  // m⁴

  const L = L_mm * 1e-3;  // m
  const m = m_rotor_kg;   // kg

  // 弹性支承 + 简支梁 弯曲挠度 (质量在跨中)
  // 轴承弹性支承的当量挠度
  // y_total = y_beam + y_bearing
  const g = 9.81;

  // 刚性支承挠度 (简支梁，中心载荷): y_rigid = P·L³/(48EI)
  // P = m·g = weight
  const P_weight = m * g;
  const y_rigid_m = P_weight * Math.pow(L, 3) / (48 * E * I);

  // 轴承弹性挠度 (每个轴承承担 P/2): y_brg = (P/2) / k_brg
  const k1_N_m = k1_N_um * 1e6;   // N/m
  const k2_N_m = k2_N_um * 1e6;

  // 轴承弹性引起的轴中心下沉（近似: 两端各 P/2，轴的刚体平移）
  const y_brg_m = (P_weight / 2) * (1 / k1_N_m + 1 / k2_N_m) / 2;

  const y_total_m = y_rigid_m + y_brg_m;
  const deflection_um = y_total_m * 1e6;

  // Rayleigh 法临界转速 (单自由度简化)
  // ω_cr = √(g / y_static) — for single mass
  const omega_n = y_total_m > 0 ? Math.sqrt(g / y_total_m) : Infinity;  // rad/s
  const n_crit_rpm = omega_n * 60 / (2 * Math.PI);
  const f_hz = omega_n / (2 * Math.PI);

  // 安全比
  const safety_ratio = n_crit_rpm > 0 ? n_rpm / n_crit_rpm : 0;

  // 共振警告
  let warnings = [];
  if (safety_ratio > 0.7 && safety_ratio < 1.3) {
    warnings.push(`⚠ 危险：运行转速 ${n_rpm}rpm 在临界转速 ${n_crit_rpm.toFixed(0)}rpm 的共振区 (±30%)`);
  } else if (safety_ratio > 0.5 && safety_ratio <= 0.7) {
    warnings.push(`⚡ 注意：安全裕度偏小 (${safety_ratio.toFixed(2)})，建议增加轴径`);
  }

  // 刚性+柔性分类
  const shaftType = safety_ratio < 0.7 ? '刚性轴 (低于临界转速)' :
                    safety_ratio > 1.3 ? '柔性轴 (高于临界转速)' :
                    '共振区 — 请调整设计!';

  return {
    n_crit_rpm: isFinite(n_crit_rpm) ? Number(n_crit_rpm.toFixed(0)) : Infinity,
    omega_n_rads: isFinite(omega_n) ? Number(omega_n.toFixed(2)) : Infinity,
    f_hz: isFinite(f_hz) ? Number(f_hz.toFixed(2)) : Infinity,
    deflection_um: Number(deflection_um.toFixed(2)),
    y_rigid_um: Number(y_rigid_m * 1e6).toFixed(2),
    y_bearing_um: Number(y_brg_m * 1e6).toFixed(2),
    safety_ratio: Number(safety_ratio.toFixed(3)),
    shaftType,
    warnings,
    status: warnings.length > 0 && warnings[0].startsWith('⚠') ? 'fail' :
            warnings.length > 0 ? 'warning' : 'qualified',
    formula: `y_rigid = P·L³/(48EI) = ${(P_weight).toFixed(1)}×${L.toFixed(3)}³/(48×${E.toFixed(1)}×${I.toExponential(3)}) = ${(y_rigid_m*1e6).toFixed(1)} μm\n` +
      `y_bearing = P/2 × (1/k₁ + 1/k₂)/2 = ${(P_weight/2).toFixed(1)} × (1/${k1_N_um}+1/${k2_N_um})/2 → ${(y_brg_m*1e6).toFixed(1)} μm\n` +
      `ω_n = √(g/y_total) = √(9.81/${y_total_m.toExponential(3)}) = ${isFinite(omega_n) ? omega_n.toFixed(1) : '∞'} rad/s\n` +
      `n_crit = ω_n×60/(2π) = ${isFinite(n_crit_rpm) ? n_crit_rpm.toFixed(0) : '∞'} rpm`
  };
}

/**
 * 轴扭转刚度与固有频率
 * 依据：机械设计手册 第2卷 §19-116
 *
 * K_t = G·J / L  [N·m/rad]
 * f_t = (1/2π) × √(K_t / I_p)  [Hz]
 *
 * @param {object} p
 * @param {number} p.d_shaft - 轴径 mm
 * @param {number} p.L_shaft - 轴段长度 mm
 * @param {string} p.shaftMaterial
 * @param {number} p.J_load - 负载转动惯量 kg·m² (可选)
 * @returns {{ Kt_Nm_rad, f_hz, formula }}
 */
function calcTorsionalNaturalFreq(p) {
  const {
    d_shaft = 40,
    L_shaft = 300,
    shaftMaterial = '45钢',
    J_load = 0     // kg·m² (optional, for two-mass system)
  } = p;

  const mat = SHAFT_MATERIALS[shaftMaterial] || SHAFT_MATERIALS['45钢'];
  const G = mat.G_MPa * 1e6;  // Pa

  const props = shaftSectionProps(d_shaft);
  const J_shaft = props.J_mm4 * 1e-12;  // m⁴

  // 扭转刚度 [N·m/rad]
  const L_m = L_shaft * 1e-3;
  const Kt = G * J_shaft / L_m;

  // 轴的转动惯量 [kg·m²]
  const rho = mat.rho_kgm3;
  const m_shaft = rho * Math.PI * Math.pow(d_shaft*1e-3/2, 2) * L_m;
  const I_p_shaft = m_shaft * Math.pow(d_shaft*1e-3/2, 2) / 2;  // solid cylinder

  // 单质量扭转频率
  let f_hz;
  if (J_load > 0) {
    // 两质量系统
    f_hz = (1 / (2 * Math.PI)) * Math.sqrt(Kt * (1/I_p_shaft + 1/J_load));
  } else {
    // 仅轴的分布质量（近似）
    f_hz = (1 / (2 * Math.PI)) * Math.sqrt(Kt / (I_p_shaft / 2));
  }

  return {
    Kt_Nm_rad: Number(Kt.toFixed(1)),
    J_shaft_m4: J_shaft,
    I_p_shaft_kgm2: Number(I_p_shaft.toExponential(3)),
    f_hz: isFinite(f_hz) ? Number(f_hz.toFixed(1)) : Infinity,
    formula: `K_t = G·J/L = ${G.toExponential(2)}×${J_shaft.toExponential(3)}/${L_m.toFixed(3)} = ${Kt.toFixed(0)} N·m/rad\n` +
      `I_p = m·r²/2 = ${m_shaft.toFixed(2)}×(${((d_shaft*1e-3/2).toFixed(4))})²/2 = ${I_p_shaft.toExponential(3)} kg·m²\n` +
      `f_t = 1/(2π)·√(K_t/I_eff) = ${isFinite(f_hz) ? f_hz.toFixed(1) : '∞'} Hz`
  };
}

/**
 * 挠度详细计算 — 弹性支承多截面轴
 * 叠加法求最大挠度
 *
 * @param {object} p — 与 calcShaftCriticalSpeed 相同
 * @returns {{ maxDeflection_um, rotorDeflection_um, status }}
 */
function calcShaftDeflection(p) {
  const {
    k1_N_um = 100,
    k2_N_um = 100,
    L_mm = 300,
    d_shaft = 40,
    m_rotor_kg = 20,
    shaftMaterial = '45钢',
    n_rpm = 3000,
    overhung_N = 0,        // 悬臂端力 N
    overhung_L_mm = 0      // 悬臂长度 mm
  } = p;

  const mat = SHAFT_MATERIALS[shaftMaterial] || SHAFT_MATERIALS['45钢'];
  const E = mat.E_MPa * 1e6;  // Pa

  const L = L_mm * 1e-3;
  const I = Math.PI * Math.pow(d_shaft * 1e-3, 4) / 64;

  // 最大允许挠度 (通常 L/3000 for general machinery)
  const maxAllowable = L_mm / 3000 * 1000;  // μm

  // 刚性支点挠度
  const g = 9.81;
  const P = m_rotor_kg * g;
  const y_beam_m = P * Math.pow(L, 3) / (48 * E * I);

  // 轴承弹性
  const k1 = k1_N_um * 1e6;
  const k2 = k2_N_um * 1e6;
  const y_brg_m = (P / 2) * (1/k1 + 1/k2) / 2;

  // 悬臂端额外挠度
  let y_overhang_m = 0;
  if (overhung_N > 0 && overhung_L_mm > 0) {
    const L_oh = overhung_L_mm * 1e-3;
    const F = overhung_N;
    // 悬臂端对跨距内最大挠度的贡献（大致）
    y_overhang_m = F * L_oh * L * L / (16 * E * I);  // 简化
  }

  const y_total = y_beam_m + y_brg_m + y_overhang_m;
  const defl_um = y_total * 1e6;

  // 0.02mm = 20μm = typical limit for electric motor shaft
  const status_defl = defl_um <= 20 ? 'qualified' : (defl_um <= 50 ? 'warning' : 'fail');

  return {
    maxDeflection_um: Number(defl_um.toFixed(2)),
    y_beam_um: Number(y_beam_m * 1e6).toFixed(2),
    y_bearing_um: Number(y_brg_m * 1e6).toFixed(2),
    y_overhang_um: Number(y_overhang_m * 1e6).toFixed(2),
    maxAllowable_um: Number(maxAllowable.toFixed(1)),
    status: status_defl,
    statusText: status_defl === 'qualified' ? '挠度在允许范围内 (≤20μm)' :
                status_defl === 'warning' ? `挠度偏大 (${defl_um.toFixed(1)}μm > 20μm)` :
                `挠度过大 (${defl_um.toFixed(1)}μm)，需增加轴径`,
    formula: `y_beam = P·L³/(48EI) = ${(y_beam_m*1e6).toFixed(1)} μm\n` +
      `y_brg = ${(y_brg_m*1e6).toFixed(1)} μm\n` +
      `y_total = ${defl_um.toFixed(1)} μm`
  };
}

/**
 * 轴系力学主计算
 *
 * @param {object} p
 * @returns {{ criticalSpeed, deflection, torsional }}
 */
function calcShaftSystem(p) {
  const criticalSpeed = calcShaftCriticalSpeed(p);
  const deflection = calcShaftDeflection(p);
  const torsional = calcTorsionalNaturalFreq(p);

  return {
    criticalSpeed,
    deflection,
    torsional,
    summary: `轴系力学：n_crit=${criticalSpeed.n_crit_rpm} rpm (${criticalSpeed.shaftType}), ` +
      `f_tors=${torsional.f_hz} Hz, 挠度=${deflection.maxDeflection_um} μm`
  };
}

// ============================================================
// 十四、总协调器 — 根据 mode 调度各域
// ============================================================

/**
 * 轴承校核主计算函数
 * 根据 mode 调用 SKF 和/或 NSK 和/或轴系力学
 *
 * @param {object} p — 统一参数
 * @param {string} p.mode — 'SKF' | 'NSK' | 'full'
 * @param {boolean} p.includeShaft — 是否包含轴系力学
 * @returns {{ mode, skf, nsk, shaft, summary }}
 */
function calcBearingAll(p) {
  const {
    mode = 'SKF',
    includeShaft = false,

    // 轴承参数
    bearingType = 'deepGrooveBall',
    d = 40, D = 80, B = 18,      // 轴承几何
    Dpw, Dw, Z, alpha = 0,        // 内部几何
    C_kN = 32.5, C0_kN = 19.0, Pu_kN = 0.8,  // 额定值
    speedGrease = 11000, speedOil = 13000,     // 参考转速

    // 载荷
    Fr_N = 2000, Fa_N = 500,
    n_rpm = 1500,

    // 润滑
    lubType = 'grease',
    isoVG = 68,
    greaseType = 'LGMT2',
    T_op_C = 60,
    cleanliness = 'normal',

    // SKF 参数
    reliability = 90,
    applicationType = 'normal',
    loadCondition = 'rotatingIR',

    // NSK 参数
    preloadLevel = 'L',
    customForce_N = 0,
    cageType = 'phenolic',
    ballMaterial = 'steel',
    precision = 'P5',
    arrangement = 'DB',

    // 轴系参数
    k_brg1_N_um = 50,
    k_brg2_N_um = 50,
    L_bearing_mm = 300,
    d_shaft = 40,
    m_rotor_kg = 20,
    shaftMaterial = '45钢',
    J_load = 0,

    // 附加
    extra = {}
  } = p;

  // 计算 dm（如未提供）
  const dm = Dpw || ((d + D) / 2);

  // 污染系数
  const cleanData = CONTAMINATION_FACTORS[cleanliness] || CONTAMINATION_FACTORS['normal'];
  const eta_c = cleanData.eta_c;

  // 工作粘度 — 根据油/脂选择
  let nu_mm2s, nu40;
  if (lubType === 'grease') {
    const greaseData = GREASE_BASE_OIL[greaseType] || GREASE_BASE_OIL['LGMT2'];
    nu40 = greaseData.nu40;
    // 脂的基础油粘度温变近似
    const viscResult = getOperatingViscosity(46, T_op_C); // greases ~ISO VG 46-150
    nu_mm2s = viscResult.nu_mm2s * (nu40 / viscResult.nu40);
  } else {
    const viscResult = getOperatingViscosity(isoVG, T_op_C);
    nu_mm2s = viscResult.nu_mm2s;
    nu40 = viscResult.nu40;
  }

  const result = { mode, includeShaft };

  // ---- SKF 计算 ----
  const extraObj = Object.assign({ alpha }, extra);

  const skfResult = calcSKFModifiedLife({
    C_kN, C0_kN, Pu_kN,
    Fr_N, Fa_N, n_rpm,
    bearingType,
    isoVG, T_op_C, eta_c,
    reliability,
    d, D, Dpw: dm,
    extra: extraObj
  });

  if (skfResult.error) return { error: true, message: skfResult.message };

  // 静强度
  const staticSafety = checkStaticSafety(C0_kN, skfResult.P0_N, applicationType, skfResult.family);

  // 摩擦
  const friction = calcFrictionMoment({
    bearingType, dm, Fr_N, Fa_N, n_rpm,
    nu_mm2s, kappa: skfResult.kappa
  });

  // 极限转速
  const speed = checkSpeedRating({
    n_rpm, speedGrease, speedOil,
    P_N: skfResult.P_N, C_kN, dm,
    lubType
  });

  // 配合
  const fits = getRecommendedFits(loadCondition, d, D, skfResult.P_N, C_kN);

  // 游隙
  const clearance = getClearanceRecommendation(d, D, T_op_C - 20, n_rpm);  // 假设环境20°C

  // 再润滑
  const relub = calcRelubrication(n_rpm, dm, bearingType, T_op_C);

  result.skf = {
    life: skfResult,
    staticSafety,
    friction,
    speed,
    fits,
    clearance,
    relubrication: relub
  };

  // ---- NSK 计算 ----
  if (mode === 'NSK' || mode === 'full') {
    result.nsk = calcBearingNSK({
      bearingType, d, D, Dw: Dw || 12.7, Z: Z || 9, alpha,
      C0_kN, n_rpm, Fr_N, Fa_N,
      preloadLevel, customForce_N,
      cageType, ballMaterial, precision,
      arrangement,speedGrease, speedOil,
      C_kN, Pu_kN,
      isoVG, T_op_C, eta_c, reliability
    });
  }

  // ---- 轴系力学 ----
  if (includeShaft) {
    // 从 NSK 获取刚度（如有），否则用户手动输入
    const k1 = (result.nsk && result.nsk.stiffness)
      ? result.nsk.stiffness.k_radial_N_um : k_brg1_N_um;
    const k2 = (result.nsk && result.nsk.stiffness)
      ? result.nsk.stiffness.k_radial_N_um : k_brg2_N_um;

    result.shaft = calcShaftSystem({
      k1_N_um: k1, k2_N_um: k2,
      L_mm: L_bearing_mm,
      d_shaft, m_rotor_kg, shaftMaterial,
      n_rpm, J_load
    });
  }

  // 汇总
  const lifeH = result.skf.life.Lnmh_hours;
  result.summary = `[${mode}] ${skfResult.bearingName} | ` +
    `L${RELIABILITY_FACTORS[String(reliability)] ? RELIABILITY_FACTORS[String(reliability)].Lnm : '10m'}h = ${isFinite(lifeH) ? lifeH + 'h' : '∞'} | ` +
    `s₀=${staticSafety.s0.toFixed(1)} | κ=${skfResult.kappa.toFixed(2)} | ` +
    `P_loss=${friction.P_loss_W}W`;

  return result;
}

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // 工具函数
    bilinearInterp,
    linearInterp,
    getOperatingViscosity,
    getRatedViscosity,
    calcViscosityRatio,

    // 载荷系数
    getDynamicLoadFactors,
    getStaticLoadFactors,
    calcEquivalentLoad,

    // 寿命
    calcBasicLife,
    getLifeCategory,
    calcSKFLifeFactor,
    calcSKFModifiedLife,

    // 辅助校核
    checkStaticSafety,
    calcFrictionMoment,
    checkSpeedRating,
    getRecommendedFits,
    getClearanceRecommendation,
    calcRelubrication,

    // NSK
    calcNSKPreloadStiffness,
    calcNSKSpeedLimits,
    calcNSKSpacerDelta,
    calcBearingNSK,

    // 轴系力学
    shaftSectionProps,
    calcShaftCriticalSpeed,
    calcTorsionalNaturalFreq,
    calcShaftDeflection,
    calcShaftSystem,

    // 总协调器
    calcBearingAll
  };
}
