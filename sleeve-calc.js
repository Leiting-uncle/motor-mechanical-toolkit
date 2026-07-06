// ================================================================
// sleeve-calc.js — 屏蔽套失效计算 计算层
// 依据：Vasiliev "Advanced Mechanics of Composite Materials"
//       Tsai-Wu "Journal of Composite Materials" (1971)
//       CLT Classical Lamination Theory
// 职责：纯计算函数，无 DOM 操作，所有中间变量可单独导出
// 禁止在计算层编写任何界面交互代码
// ================================================================

// ================================================================
// 一、工具函数
// ================================================================

/** 角度转弧度 */
function toRad(deg) { return deg * Math.PI / 180; }

/** 弧度转角度 */
function toDeg(rad) { return rad * 180 / Math.PI; }

/** 保留3位小数的工程精度 */
function toFixed3(v) { return Math.round(v * 1000) / 1000; }

/**
 * 3×3 对称矩阵求逆
 * 用于 A 矩阵求逆（A 为对称正定矩阵）
 * @param {number[][]} M — 3×3 matrix as [[a,b,d],[b,c,e],[d,e,f]]
 * @returns {number[][]} 逆矩阵 3×3
 */
function invertMatrix3x3(M) {
  var a = M[0][0], b = M[0][1], d = M[0][2];
  var c = M[1][1], e = M[1][2];
  var f = M[2][2];
  // 3×3 对称矩阵行列式
  var det = a * (c * f - e * e) - b * (b * f - d * e) + d * (b * e - c * d);
  if (Math.abs(det) < 1e-20) {
    throw new Error('矩阵奇异，无法求逆');
  }
  var invDet = 1 / det;
  return [
    [ (c * f - e * e) * invDet,  (d * e - b * f) * invDet,  (b * e - c * d) * invDet ],
    [ (d * e - b * f) * invDet,  (a * f - d * d) * invDet,  (b * d - a * e) * invDet ],
    [ (b * e - c * d) * invDet,  (b * d - a * e) * invDet,  (a * c - b * b) * invDet ]
  ];
}

// ================================================================
// 二、层合板力学 (CLT)
// ================================================================

/**
 * 正交各向异性单层板折减刚度矩阵 Q（平面应力）
 * 公式：
 *   ν₂₁ = ν₁₂ × E₂ / E₁
 *   Q₁₁ = E₁ / (1 − ν₁₂·ν₂₁)
 *   Q₂₂ = E₂ / (1 − ν₁₂·ν₂₁)
 *   Q₁₂ = ν₁₂·E₂ / (1 − ν₁₂·ν₂₁)
 *   Q₆₆ = G₁₂
 *
 * @param {number} E1_MPa — 纵向弹性模量 (MPa)
 * @param {number} E2_MPa — 横向弹性模量 (MPa)
 * @param {number} nu12   — 主泊松比
 * @param {number} G12_MPa — 面内剪切模量 (MPa)
 * @returns {{ Q11, Q22, Q12, Q66, matrix: number[][] }}
 */
function calcQPlane(E1_MPa, E2_MPa, nu12, G12_MPa) {
  var nu21 = nu12 * E2_MPa / E1_MPa;
  var denom = 1 - nu12 * nu21;
  var Q11 = E1_MPa / denom;
  var Q22 = E2_MPa / denom;
  var Q12 = nu12 * E2_MPa / denom;
  var Q66 = G12_MPa;

  return {
    Q11: toFixed3(Q11),
    Q22: toFixed3(Q22),
    Q12: toFixed3(Q12),
    Q66: toFixed3(Q66),
    nu21: toFixed3(nu21),
    matrix: [
      [toFixed3(Q11), toFixed3(Q12), 0],
      [toFixed3(Q12), toFixed3(Q22), 0],
      [0, 0, toFixed3(Q66)]
    ]
  };
}

/**
 * 坐标变换：材料坐标系 Q → 全局坐标系 Q̄
 * 使用 Reuter 变换矩阵 T：
 *   Q̄₁₁ = Q₁₁·c⁴ + 2(Q₁₂+2Q₆₆)·c²s² + Q₂₂·s⁴
 *   Q̄₁₂ = Q₁₂(c⁴+s⁴) + (Q₁₁+Q₂₂−4Q₆₆)·c²s²
 *   Q̄₁₆ = (Q₁₁−Q₁₂−2Q₆₆)·c³s − (Q₂₂−Q₁₂−2Q₆₆)·cs³
 *   Q̄₂₂ = Q₁₁·s⁴ + 2(Q₁₂+2Q₆₆)·c²s² + Q₂₂·c⁴
 *   Q̄₂₆ = (Q₁₁−Q₁₂−2Q₆₆)·cs³ − (Q₂₂−Q₁₂−2Q₆₆)·c³s
 *   Q̄₆₆ = (Q₁₁+Q₂₂−2Q₁₂−2Q₆₆)·c²s² + Q₆₆(c⁴+s⁴)
 *
 * @param {{ Q11, Q22, Q12, Q66 }} Q — 材料坐标系刚度
 * @param {number} theta_deg — 铺层角度（度）
 * @returns {{ matrix: number[][] }}
 */
function calcQbar(Q, theta_deg) {
  var theta = toRad(theta_deg);
  var c = Math.cos(theta), s = Math.sin(theta);
  var c2 = c * c, s2 = s * s;
  var c4 = c2 * c2, s4 = s2 * s2;
  var c2s2 = c2 * s2;
  var c3s = c2 * c * s, cs3 = c * s2 * s;

  var Q11_l = Q.Q11, Q22_l = Q.Q22, Q12_l = Q.Q12, Q66_l = Q.Q66;

  var Qbar11 = Q11_l * c4 + 2 * (Q12_l + 2 * Q66_l) * c2s2 + Q22_l * s4;
  var Qbar12 = Q12_l * (c4 + s4) + (Q11_l + Q22_l - 4 * Q66_l) * c2s2;
  var Qbar16 = (Q11_l - Q12_l - 2 * Q66_l) * c3s - (Q22_l - Q12_l - 2 * Q66_l) * cs3;
  var Qbar22 = Q11_l * s4 + 2 * (Q12_l + 2 * Q66_l) * c2s2 + Q22_l * c4;
  var Qbar26 = (Q11_l - Q12_l - 2 * Q66_l) * cs3 - (Q22_l - Q12_l - 2 * Q66_l) * c3s;
  var Qbar66 = (Q11_l + Q22_l - 2 * Q12_l - 2 * Q66_l) * c2s2 + Q66_l * (c4 + s4);

  return {
    matrix: [
      [toFixed3(Qbar11), toFixed3(Qbar12), toFixed3(Qbar16)],
      [toFixed3(Qbar12), toFixed3(Qbar22), toFixed3(Qbar26)],
      [toFixed3(Qbar16), toFixed3(Qbar26), toFixed3(Qbar66)]
    ]
  };
}

/**
 * 构建层合板 ABD 矩阵
 *   A_ij = Σ (Q̄_ij)_k × (z_k − z_{k-1})
 *   B_ij = ½ Σ (Q̄_ij)_k × (z_k² − z_{k-1}²)
 *   D_ij = ⅓ Σ (Q̄_ij)_k × (z_k³ − z_{k-1}³)
 *
 * 铺层编号从内表面(k=1)到外表面(k=N)
 * z 坐标以中面为零点，向外为正
 *
 * @param {number[]} plyAngles_deg — 各铺层角度（从内到外）
 * @param {number} plyThick_mm — 单层厚度 (mm)
 * @param {{ Q11, Q22, Q12, Q66 }} Qply — 单层材料刚度
 * @returns {{ A: number[][], B: number[][], D: number[][], totalThickness: number, zCoords: number[], stiffnessData: object }}
 */
function calcABD(plyAngles_deg, plyThick_mm, Qply) {
  var N = plyAngles_deg.length;
  var totalThick = N * plyThick_mm;
  var zBottom = -totalThick / 2;

  var A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  var B = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  var D = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  var zCoords = [];

  var zk_1 = zBottom;
  for (var k = 0; k < N; k++) {
    var zk = zk_1 + plyThick_mm;
    zCoords.push({ k: k + 1, angle_deg: plyAngles_deg[k], z_bottom: toFixed3(zk_1), z_top: toFixed3(zk) });

    var Qbar_k = calcQbar(Qply, plyAngles_deg[k]).matrix;
    var dz = zk - zk_1;
    var zk2 = zk * zk, zk12 = zk_1 * zk_1;
    var zk3 = zk2 * zk, zk13 = zk12 * zk_1;

    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 3; j++) {
        var q = Qbar_k[i][j];
        A[i][j] += q * dz;
        B[i][j] += q * (zk2 - zk12) / 2;
        D[i][j] += q * (zk3 - zk13) / 3;
      }
    }
    zk_1 = zk;
  }

  // 格式化保留精度
  for (var i2 = 0; i2 < 3; i2++) {
    for (var j2 = 0; j2 < 3; j2++) {
      A[i2][j2] = toFixed3(A[i2][j2]);
      B[i2][j2] = toFixed3(B[i2][j2]);
      D[i2][j2] = toFixed3(D[i2][j2]);
    }
  }

  // 检查 B 矩阵是否近似为零（对称层合板）
  var bMax = Math.abs(B[0][0]) + Math.abs(B[1][1]) + Math.abs(B[2][2]);
  var isSymmetric = bMax < 0.01;

  return {
    A: A,
    B: B,
    D: D,
    totalThickness: toFixed3(totalThick),
    zCoords: zCoords,
    isSymmetric: isSymmetric,
    stiffnessData: {
      A11: A[0][0], A22: A[1][1], A12: A[0][1], A66: A[2][2],
      D11: D[0][0], D22: D[1][1], D12: D[0][1], D66: D[2][2]
    }
  };
}

/**
 * 从 A 矩阵计算层合板等效工程常数
 * 对对称层合板（B≈0）：[a] = t·[A]⁻¹
 *   E_x = 1/(a₁₁·t)
 *   E_y = 1/(a₂₂·t)
 *   G_xy = 1/(a₆₆·t)
 *   ν_xy = −a₁₂/a₁₁
 *
 * @param {number[][]} A — 拉伸刚度矩阵 (N/mm)
 * @param {number} t_mm — 总厚度 (mm)
 * @returns {{ Ex_MPa, Ey_MPa, Gxy_MPa, nuxy }}
 */
function effectiveConstants(A, t_mm) {
  var Ainv = invertMatrix3x3(A);
  var Ex = 1 / (Ainv[0][0] * t_mm);
  var Ey = 1 / (Ainv[1][1] * t_mm);
  var Gxy = 1 / (Ainv[2][2] * t_mm);
  var nuxy = -Ainv[0][1] / Ainv[0][0];

  return {
    Ex_MPa: toFixed3(Ex),
    Ey_MPa: toFixed3(Ey),
    Gxy_MPa: toFixed3(Gxy),
    nuxy: toFixed3(nuxy),
    Ainv: Ainv
  };
}

// ================================================================
// 三、Tsai-Wu 失效准则
// ================================================================

/**
 * 计算 Tsai-Wu 强度参数
 *   F₁ = 1/X_t − 1/X_c
 *   F₂ = 1/Y_t − 1/Y_c
 *   F₁₁ = 1/(X_t·X_c)
 *   F₂₂ = 1/(Y_t·Y_c)
 *   F₆₆ = 1/S²
 *   F₁₂ = −½√(F₁₁·F₂₂)  （标准 von Mises 等效）
 *
 * @param {{ X_t_MPa, X_c_MPa, Y_t_MPa, Y_c_MPa, S_MPa }} strengths
 * @returns {{ F1, F2, F11, F22, F66, F12 }}
 */
function calcTsaiWuCoeffs(strengths) {
  var Xt = strengths.X_t_MPa, Xc = strengths.X_c_MPa;
  var Yt = strengths.Y_t_MPa, Yc = strengths.Y_c_MPa;
  var S = strengths.S_MPa;

  var F1 = 1 / Xt - 1 / Xc;
  var F2 = 1 / Yt - 1 / Yc;
  var F11 = 1 / (Xt * Xc);
  var F22 = 1 / (Yt * Yc);
  var F66 = 1 / (S * S);
  var F12 = -0.5 * Math.sqrt(F11 * F22);

  return {
    F1: toFixed3(F1),
    F2: toFixed3(F2),
    F11: toFixed3(F11),
    F22: toFixed3(F22),
    F66: toFixed3(F66),
    F12: toFixed3(F12)
  };
}

/**
 * 计算 Tsai-Wu 失效指数
 *   TW = F₁σ₁ + F₂σ₂ + F₁₁σ₁² + F₂₂σ₂² + F₆₆τ₁₂² + 2F₁₂σ₁σ₂
 *   TW ≥ 1 → 失效
 *
 * @param {{ F1,F2,F11,F22,F66,F12 }} TW — 强度参数
 * @param {number} sig1 — σ₁ (MPa)，纤维方向应力
 * @param {number} sig2 — σ₂ (MPa)，横向应力
 * @param {number} tau12 — τ₁₂ (MPa)，面内剪切
 * @returns {{ twIndex: number, isFailed: boolean, components: object }}
 */
function evaluateTsaiWu(TW, sig1, sig2, tau12) {
  var lin = TW.F1 * sig1 + TW.F2 * sig2;
  var quad = TW.F11 * sig1 * sig1 + TW.F22 * sig2 * sig2 +
             TW.F66 * tau12 * tau12 + 2 * TW.F12 * sig1 * sig2;
  var twIndex = lin + quad;

  return {
    twIndex: toFixed3(twIndex),
    isFailed: twIndex >= 1.0,
    linearTerm: toFixed3(lin),
    quadTerm: toFixed3(quad),
    components: {
      F1_s1: toFixed3(TW.F1 * sig1),
      F2_s2: toFixed3(TW.F2 * sig2),
      F11_s1sq: toFixed3(TW.F11 * sig1 * sig1),
      F22_s2sq: toFixed3(TW.F22 * sig2 * sig2),
      F66_t12sq: toFixed3(TW.F66 * tau12 * tau12),
      F12_interact: toFixed3(2 * TW.F12 * sig1 * sig2)
    }
  };
}

/**
 * 确定失效模式（基于最大应力比）
 */
function getFailureMode(sig1, sig2, tau12, strengths) {
  var ratios = [
    { mode: '纵向拉伸 (Fiber Tension)',       value: Math.abs(sig1 / strengths.X_t_MPa), condition: sig1 > 0 },
    { mode: '纵向压缩 (Fiber Compression)',    value: Math.abs(sig1 / strengths.X_c_MPa), condition: sig1 < 0 },
    { mode: '横向拉伸 (Matrix Tension)',       value: Math.abs(sig2 / strengths.Y_t_MPa), condition: sig2 > 0 },
    { mode: '横向压缩 (Matrix Compression)',    value: Math.abs(sig2 / strengths.Y_c_MPa), condition: sig2 < 0 },
    { mode: '面内剪切 (In-plane Shear)',       value: Math.abs(tau12 / strengths.S_MPa), condition: true }
  ];
  var maxRatio = 0, maxMode = '未知';
  for (var i = 0; i < ratios.length; i++) {
    if (ratios[i].condition && ratios[i].value > maxRatio) {
      maxRatio = ratios[i].value;
      maxMode = ratios[i].mode;
    }
  }
  return { mode: maxMode, maxStressRatio: toFixed3(maxRatio) };
}

// ================================================================
// 四、圆筒应力分析与铺层应力恢复
// ================================================================

/**
 * 计算给定压力下的圆筒薄膜力
 * 薄壁圆筒 (t/R < 0.1)：
 *   N_y (环向) = pressureSign × hoopSign × p × R  (压为负)
 *   N_x (轴向) = pressureSign × axialFactor × p × R  (capped=0.5, free=0)
 *   N_xy = 0
 *
 * @param {number} p_MPa — 压力 (MPa)，始终为正数
 * @param {number} R_mm — 中面半径 (mm)
 * @param {string} pressureSign — 'external'或'internal' → sign
 * @param {string} axialEnd — 'capped'或'free'
 * @returns {{ Nx: number, Ny: number, Nxy: number }}
 */
function calcCylinderLoads(p_MPa, R_mm, pressureSign, axialEnd) {
  var pSign = (pressureSign === 'external') ? -1 : 1;
  var axialFactor = (axialEnd === 'capped') ? 0.5 : 0.0;

  // 环向力：对圆柱壳 N_y = p × R（拉为正，压为负）
  var Ny = pSign * p_MPa * R_mm;
  // 轴向力：端盖受力 → N_x = p × R / 2
  var Nx = pSign * axialFactor * p_MPa * R_mm;

  return {
    Nx: toFixed3(Nx),
    Ny: toFixed3(Ny),
    Nxy: 0
  };
}

/**
 * 铺层应力恢复
 * 从层合板载荷 → 中面应变 → 各铺层应力（材料坐标系）
 *
 * 步骤：
 *   1. {ε⁰} = [A]⁻¹{N}  （中面应变）
 *   2. 对每层: {σ}_k = [Q̄]_k{ε⁰}  （全局坐标应力）
 *   3. 坐标变换到材料坐标 (σ₁, σ₂, τ₁₂)
 *
 * @param {{ A:number[][], B:number[][], D:number[][], totalThickness:number, zCoords:object[] }} ABD
 * @param {number[]} plyAngles_deg
 * @param {{ Q11, Q22, Q12, Q66 }} Qply
 * @param {number} Nx — 轴向力 (N/mm)
 * @param {number} Ny — 环向力 (N/mm)
 * @param {{ F1,F2,F11,F22,F66,F12 }} TW — Tsai-Wu 参数（可选）
 * @returns {object[]}
 */
function calcPlyStresses(ABD, plyAngles_deg, Qply, Nx, Ny, TW, strengths) {
  var Ainv = invertMatrix3x3(ABD.A);

  // 中面应变 {ε₀} = [A]⁻¹{N}
  var eps_x = Ainv[0][0] * Nx + Ainv[0][1] * Ny;
  var eps_y = Ainv[1][0] * Nx + Ainv[1][1] * Ny;
  var gamma_xy = Ainv[2][0] * Nx + Ainv[2][1] * Ny;

  var results = [];
  for (var k = 0; k < plyAngles_deg.length; k++) {
    var theta_deg = plyAngles_deg[k];
    var Qbar_k = calcQbar(Qply, theta_deg).matrix;

    // 全局坐标应力
    var sig_x = Qbar_k[0][0] * eps_x + Qbar_k[0][1] * eps_y + Qbar_k[0][2] * gamma_xy;
    var sig_y = Qbar_k[1][0] * eps_x + Qbar_k[1][1] * eps_y + Qbar_k[1][2] * gamma_xy;
    var tau_xy = Qbar_k[2][0] * eps_x + Qbar_k[2][1] * eps_y + Qbar_k[2][2] * gamma_xy;

    // 坐标变换 → 材料坐标系
    var theta = toRad(theta_deg);
    var c = Math.cos(theta), s = Math.sin(theta);
    var sig1 = sig_x * c * c + sig_y * s * s + 2 * tau_xy * s * c;
    var sig2 = sig_x * s * s + sig_y * c * c - 2 * tau_xy * s * c;
    var tau12 = -sig_x * s * c + sig_y * s * c + tau_xy * (c * c - s * s);

    var result = {
      plyIndex: k + 1,
      angle_deg: theta_deg,
      sigma_x_MPa: toFixed3(sig_x),
      sigma_y_MPa: toFixed3(sig_y),
      tau_xy_MPa: toFixed3(tau_xy),
      sigma1_MPa: toFixed3(sig1),
      sigma2_MPa: toFixed3(sig2),
      tau12_MPa: toFixed3(tau12)
    };

    // 如果提供 TW 参数，计算失效指数
    if (TW && strengths) {
      var twResult = evaluateTsaiWu(TW, sig1, sig2, tau12);
      result.twIndex = twResult.twIndex;
      result.isFailed = twResult.isFailed;
      result.failureMode = getFailureMode(sig1, sig2, tau12, strengths).mode;
      result.twComponents = twResult.components;
    }

    results.push(result);
  }
  return results;
}

/**
 * 二分法求 Tsai-Wu 失效压力
 * 找到使任意铺层 TW 指数达到 1.0 的最小压力
 *
 * @param {{ A:number[][], B:number[][], D:number[][], totalThickness:number, zCoords:object[] }} ABD
 * @param {number[]} plyAngles_deg
 * @param {{ Q11, Q22, Q12, Q66 }} Qply
 * @param {object} material — 含强度值
 * @param {number} R_mm
 * @param {string} pressureSign — 'external'|'internal'
 * @param {string} axialEnd — 'capped'|'free'
 * @returns {{ p_fail_MPa: number, criticalPly: number, criticalAngle: number, failureMode: string, plyResults: object[], iterations: number }}
 */
function calcTsaiWuFailurePressure(ABD, plyAngles_deg, Qply, material, R_mm, pressureSign, axialEnd) {
  var TW = calcTsaiWuCoeffs({
    X_t_MPa: material.X_t_MPa,
    X_c_MPa: material.X_c_MPa,
    Y_t_MPa: material.Y_t_MPa,
    Y_c_MPa: material.Y_c_MPa,
    S_MPa: material.S_MPa
  });
  var strengths = {
    X_t_MPa: material.X_t_MPa,
    X_c_MPa: material.X_c_MPa,
    Y_t_MPa: material.Y_t_MPa,
    Y_c_MPa: material.Y_c_MPa,
    S_MPa: material.S_MPa
  };

  // 二分法搜索失效压力
  var p_lo = 0.01;
  var p_hi = 200; // 初始搜索上限 200 MPa
  var iterations = 0;
  var maxIter = 50;
  var tol = 0.01;
  var plyResults = [];

  // 扩展上限直到 TW ≥ 1
  var foundUpper = false;
  for (var i = 0; i < 10; i++) {
    var loads_hi = calcCylinderLoads(p_hi, R_mm, pressureSign, axialEnd);
    var twMax_hi = 0;
    for (var k = 0; k < plyAngles_deg.length; k++) {
      var Qbar_k = calcQbar(Qply, plyAngles_deg[k]).matrix;
      var Ainv = invertMatrix3x3(ABD.A);
      var eps_x = Ainv[0][0] * loads_hi.Nx + Ainv[0][1] * loads_hi.Ny;
      var eps_y = Ainv[1][0] * loads_hi.Nx + Ainv[1][1] * loads_hi.Ny;
      var gamma_xy = Ainv[2][0] * loads_hi.Nx + Ainv[2][1] * loads_hi.Ny;

      var sig_x = Qbar_k[0][0] * eps_x + Qbar_k[0][1] * eps_y + Qbar_k[0][2] * gamma_xy;
      var sig_y = Qbar_k[1][0] * eps_x + Qbar_k[1][1] * eps_y + Qbar_k[1][2] * gamma_xy;
      var tau_xy = Qbar_k[2][0] * eps_x + Qbar_k[2][1] * eps_y + Qbar_k[2][2] * gamma_xy;

      var theta = toRad(plyAngles_deg[k]);
      var c = Math.cos(theta), s = Math.sin(theta);
      var sig1 = sig_x * c * c + sig_y * s * s + 2 * tau_xy * s * c;
      var sig2 = sig_x * s * s + sig_y * c * c - 2 * tau_xy * s * c;
      var tau12 = -sig_x * s * c + sig_y * s * c + tau_xy * (c * c - s * s);

      var twVal = evaluateTsaiWu(TW, sig1, sig2, tau12).twIndex;
      if (twVal > twMax_hi) twMax_hi = twVal;
    }
    if (twMax_hi >= 0.99) { foundUpper = true; break; }
    p_hi *= 2;
  }
  if (!foundUpper) { p_hi = 500; } // 放宽上限

  while (iterations < maxIter && (p_hi - p_lo) > tol) {
    var p_mid = (p_lo + p_hi) / 2;
    var loads = calcCylinderLoads(p_mid, R_mm, pressureSign, axialEnd);

    var twMax = 0;
    for (var k2 = 0; k2 < plyAngles_deg.length; k2++) {
      var Qbar2 = calcQbar(Qply, plyAngles_deg[k2]).matrix;
      var Ai = invertMatrix3x3(ABD.A);
      var ex = Ai[0][0] * loads.Nx + Ai[0][1] * loads.Ny;
      var ey = Ai[1][0] * loads.Nx + Ai[1][1] * loads.Ny;
      var gxy = Ai[2][0] * loads.Nx + Ai[2][1] * loads.Ny;

      var sx = Qbar2[0][0] * ex + Qbar2[0][1] * ey + Qbar2[0][2] * gxy;
      var sy = Qbar2[1][0] * ex + Qbar2[1][1] * ey + Qbar2[1][2] * gxy;
      var txy = Qbar2[2][0] * ex + Qbar2[2][1] * ey + Qbar2[2][2] * gxy;

      var th = toRad(plyAngles_deg[k2]);
      var c2 = Math.cos(th), s2 = Math.sin(th);
      var s1 = sx * c2 * c2 + sy * s2 * s2 + 2 * txy * s2 * c2;
      var s2y = sx * s2 * s2 + sy * c2 * c2 - 2 * txy * s2 * c2;
      var t12 = -sx * s2 * c2 + sy * s2 * c2 + txy * (c2 * c2 - s2 * s2);

      var tw = evaluateTsaiWu(TW, s1, s2y, t12).twIndex;
      if (tw > twMax) twMax = tw;
    }

    if (twMax >= 1.0) { p_hi = p_mid; }
    else { p_lo = p_mid; }
    iterations++;
  }

  var p_fail = (p_lo + p_hi) / 2;

  // 计算失效压力下的逐层应力
  var loadsFail = calcCylinderLoads(p_fail, R_mm, pressureSign, axialEnd);
  plyResults = calcPlyStresses(ABD, plyAngles_deg, Qply, loadsFail.Nx, loadsFail.Ny, TW, strengths);

  // 找到关键铺层
  var criticalPly = 0, maxTW = 0;
  for (var j = 0; j < plyResults.length; j++) {
    if (plyResults[j].twIndex > maxTW) {
      maxTW = plyResults[j].twIndex;
      criticalPly = j;
    }
  }

  var fm = getFailureMode(
    plyResults[criticalPly].sigma1_MPa,
    plyResults[criticalPly].sigma2_MPa,
    plyResults[criticalPly].tau12_MPa,
    strengths
  );

  return {
    p_fail_MPa: toFixed3(p_fail),
    criticalPly: criticalPly + 1,
    criticalAngle_deg: plyAngles_deg[criticalPly],
    failureMode: fm.mode,
    maxStressRatio: fm.maxStressRatio,
    plyResults: plyResults,
    iterations: iterations
  };
}

// ================================================================
// 五、Vasiliev 屈曲模型
// ================================================================

/**
 * Vasiliev 简化临界屈曲压力
 * 核心公式（Eq. 11.184, Advanced Mechanics of Composite Materials）：
 *   p_cr(n) = (D₂₂/R³)(n²−1) + π⁴·A₁₁·R³ / (L⁴·n⁴·(n²−1))
 *
 * 其中：
 *   D₂₂ = 环向弯曲刚度 (N·mm)
 *   A₁₁ = 轴向薄膜刚度 (N/mm)
 *   R   = 中面半径 (mm)
 *   L   = 有效长度 L/m (mm)，m=1
 *   n   = 周向屈曲波数 (n ≥ 2)
 *
 * 公式适用条件：中等长度圆柱壳，半薄膜壳理论
 *
 * @param {number} R_mm — 中面半径 (mm)
 * @param {number} L_mm — 有效长度 (mm)
 * @param {number} n — 周向波数 (n ≥ 2)
 * @param {number} A11 — 轴向拉伸刚度 (N/mm)
 * @param {number} D22 — 环向弯曲刚度 (N·mm)
 * @returns {number} p_cr (MPa)
 */
function calcVasilievPn(R_mm, L_mm, n, A11, D22) {
  if (n < 2) return Infinity;
  var n2 = n * n;
  var n4 = n2 * n2;
  var nm1 = n2 - 1;
  var R3 = R_mm * R_mm * R_mm;
  var L4 = L_mm * L_mm * L_mm * L_mm;
  var pi4 = Math.PI * Math.PI * Math.PI * Math.PI;

  // 第一项：环向弯曲项
  var term1 = (D22 / R3) * nm1;
  // 第二项：轴向薄膜项
  var term2 = (pi4 * A11 * R3) / (L4 * n4 * nm1);

  return term1 + term2;
}

/**
 * 遍历 n 寻找最小临界屈曲压力
 * 从 n=2 开始，当 p_cr 连续 3 次递增时停止
 *
 * @param {number} R_mm
 * @param {number} L_mm
 * @param {number} A11
 * @param {number} D22
 * @returns {{ p_cr_MPa: number, n_cr: number, allModes: object[], formula: string }}
 */
function calcVasilievCritPressure(R_mm, L_mm, A11, D22) {
  var p_min = Infinity;
  var n_cr = 0;
  var allModes = [];
  var increasingCount = 0;

  for (var n = 2; n <= 30; n++) {
    var pn = calcVasilievPn(R_mm, L_mm, n, A11, D22);
    allModes.push({ n: n, p_cr_MPa: toFixed3(pn) });

    if (pn < p_min) {
      p_min = pn;
      n_cr = n;
      increasingCount = 0;
    } else {
      increasingCount++;
      if (increasingCount >= 3 && n > n_cr + 2) break;
    }
  }

  return {
    p_cr_MPa: toFixed3(p_min),
    n_cr: n_cr,
    m_cr: 1,
    allModes: allModes,
    formula: 'p_cr(n) = (D₂₂/R³)(n²−1) + π⁴A₁₁R³/(L⁴·n⁴·(n²−1)), n≥2'
  };
}

// ================================================================
// 六、失效曲线图数据生成
// ================================================================

/**
 * 生成失效机制图数据
 * 壁厚 t 扫描：对每层厚度，通过改变铺层数改变总厚度
 *
 * @param {number} R_mm
 * @param {number} L_mm
 * @param {object} material — 含 E1_GPa, E2_GPa, G12_GPa, nu12, X_t_MPa 等
 * @param {number[]} plyAngles_deg
 * @param {number} t_ply_mm — 单层厚度
 * @param {string} pressureSign
 * @param {string} axialEnd
 * @param {number} nPoints — 数据点数
 * @param {number} t_design_mm — 设计壁厚
 * @param {number} p_design_MPa — 设计压力
 * @returns {{ thicknesses: number[], buckling: number[], failure: number[], designPoint: object }}
 */
function generateFailureMapData(R_mm, L_mm, material, plyAngles_deg, t_ply_mm,
                                 pressureSign, axialEnd, nPoints, t_design_mm, p_design_MPa) {
  var nLayers = Math.round(t_design_mm / t_ply_mm);
  if (nLayers < 2) nLayers = 2;

  // 扫描范围：设计厚度的 0.25x ~ 3.0x
  var t_min = Math.max(t_ply_mm * 2, t_design_mm * 0.25);
  var t_max = Math.max(t_ply_mm * 6, t_design_mm * 3.0);
  nPoints = nPoints || 25;

  var thicknesses = [];
  var buckling = [];
  var failure = [];

  // 准备材料属性
  var E1 = material.E1_GPa * 1000;
  var E2 = material.E2_GPa * 1000;
  var G12 = material.G12_GPa * 1000;
  var Qply = calcQPlane(E1, E2, material.nu12, G12);

  for (var i = 0; i < nPoints; i++) {
    var t = t_min + (t_max - t_min) * i / (nPoints - 1);
    var nL = Math.round(t / t_ply_mm);
    if (nL < 2) nL = 2;
    var angles;
    if (plyAngles_deg.length === 1 && plyAngles_deg[0] === 90) {
      // 单角度铺层：重复角度
      angles = [];
      for (var j = 0; j < nL; j++) angles.push(plyAngles_deg[0]);
    } else if (plyAngles_deg.length === 2 && plyAngles_deg[0] === -plyAngles_deg[1]) {
      // [±θ] 重复铺层：确保偶数层
      if (nL % 2 !== 0) nL++;
      angles = [];
      for (var j2 = 0; j2 < nL / 2; j2++) {
        angles.push(plyAngles_deg[0]);
        angles.push(plyAngles_deg[1]);
      }
    } else {
      // 一般重复：整组重复
      var groupSize = plyAngles_deg.length;
      var repeats = Math.max(1, Math.round(nL / groupSize));
      nL = repeats * groupSize;
      angles = [];
      for (var r = 0; r < repeats; r++) {
        for (var k = 0; k < groupSize; k++) {
          angles.push(plyAngles_deg[k]);
        }
      }
    }

    var actualT = nL * t_ply_mm;
    thicknesses.push(toFixed3(actualT));

    var ABD = calcABD(angles, t_ply_mm, Qply);

    // 屈曲分析
    var buckleResult = calcVasilievCritPressure(R_mm, L_mm, ABD.stiffnessData.A11, ABD.stiffnessData.D22);
    buckling.push(buckleResult.p_cr_MPa);

    // 材料失效分析
    var failResult = calcTsaiWuFailurePressure(ABD, angles, Qply, material, R_mm, pressureSign, axialEnd);
    failure.push(failResult.p_fail_MPa);
  }

  // 设计点
  var dpAngles = [];
  var dpRepeatGroup = plyAngles_deg;
  if (plyAngles_deg.length === 2 && plyAngles_deg[0] === -plyAngles_deg[1]) {
    if (nLayers % 2 !== 0) nLayers++;
    for (var d = 0; d < nLayers / 2; d++) {
      dpAngles.push(plyAngles_deg[0]);
      dpAngles.push(plyAngles_deg[1]);
    }
  } else {
    var dpGroupSize = plyAngles_deg.length;
    var dpRepeats = Math.max(1, Math.round(nLayers / dpGroupSize));
    for (var rd = 0; rd < dpRepeats; rd++) {
      for (var kd = 0; kd < dpGroupSize; kd++) {
        dpAngles.push(plyAngles_deg[kd]);
      }
    }
  }
  var dpABD = calcABD(dpAngles, t_ply_mm, Qply);
  var dpBuckle = calcVasilievCritPressure(R_mm, L_mm, dpABD.stiffnessData.A11, dpABD.stiffnessData.D22);
  var dpFail = calcTsaiWuFailurePressure(dpABD, dpAngles, Qply, material, R_mm, pressureSign, axialEnd);

  return {
    thicknesses: thicknesses,
    buckling: buckling,
    failure: failure,
    nPoints: thicknesses.length,
    tRange: { min: t_min, max: t_max },
    designPoint: {
      t_mm: toFixed3(t_design_mm),
      n_layers: nLayers,
      p_design_MPa: p_design_MPa,
      p_buckling_MPa: dpBuckle.p_cr_MPa,
      p_failure_MPa: dpFail.p_fail_MPa,
      n_cr: dpBuckle.n_cr
    }
  };
}

// ================================================================
// 七、主协调器
// ================================================================

/**
 * 屏蔽套完整失效分析
 *
 * @param {object} params:
 *   R_mm, L_mm, t_ply_mm, n_layers — 几何
 *   plyAngles_deg[] — 铺层角度数组
 *   material           — 复合材料对象（含 E1_GPa, X_t_MPa 等所有字段）
 *   endCondition       — 'simplySupported'|'clamped'
 *   pressureDir        — 'external'|'internal'
 *   axialEnd           — 'capped'|'free'
 *   p_design_MPa       — 设计压力
 *   mapPoints (optional) — 曲线图点数，默认25
 * @returns {object}
 */
function calcSleeveAll(params) {
  // ---- 参数解构与验证 ----
  var R = params.R_mm || 0;
  var L = params.L_mm || 0;
  var t_ply = params.t_ply_mm || 0;
  var nLayers = params.n_layers || 0;
  var plyAngles = params.plyAngles_deg || [];
  var material = params.material || {};
  var endCondition = params.endCondition || 'simplySupported';
  var pressureDir = params.pressureDir || 'external';
  var axialEnd = params.axialEnd || 'capped';
  var pDesign = params.p_design_MPa || 0;
  var mapPoints = params.mapPoints || 25;

  if (!R || !L || !t_ply || !nLayers || plyAngles.length === 0) {
    return { error: true, message: '请填写所有必填参数' };
  }
  if (R / (nLayers * t_ply) < 5) {
    return { error: true, message: '壁厚过大(R/t < 5)，薄壁壳体公式已不再适用，请减小壁厚或增大半径' };
  }

  var totalThick = nLayers * t_ply;

  // ---- 材料准备 ----
  var E1 = material.E1_GPa * 1000;
  var E2 = material.E2_GPa * 1000;
  var G12 = material.G12_GPa * 1000;
  var Qply = calcQPlane(E1, E2, material.nu12, G12);

  // ---- 构建实际铺层序列 ----
  var actualAngles;
  if (plyAngles.length === 2 && plyAngles[0] === -plyAngles[1]) {
    // [±θ] 重复 → 确保偶数层
    if (nLayers % 2 !== 0) { return { error: true, message: '[±θ] 铺层需要偶数层数' }; }
    actualAngles = [];
    for (var i = 0; i < nLayers / 2; i++) {
      actualAngles.push(plyAngles[0]);
      actualAngles.push(plyAngles[1]);
    }
  } else if (plyAngles.length === nLayers) {
    // 用户精确指定了每层角度
    actualAngles = plyAngles.slice();
  } else {
    // 一般情况：重复铺层组
    var groupSize = plyAngles.length;
    var repeats = Math.round(nLayers / groupSize);
    if (repeats < 1) repeats = 1;
    actualAngles = [];
    for (var r = 0; r < repeats; r++) {
      for (var j = 0; j < groupSize; j++) {
        actualAngles.push(plyAngles[j]);
      }
    }
  }

  // ---- Step 1: CLT 层合板分析 ----
  var ABD = calcABD(actualAngles, t_ply, Qply);
  var effConst = effectiveConstants(ABD.A, ABD.totalThickness);

  // ---- Step 2: Vasiliev 屈曲分析 ----
  var buckling = calcVasilievCritPressure(R, L, ABD.stiffnessData.A11, ABD.stiffnessData.D22);

  // ---- Step 3: Tsai-Wu 材料失效分析 ----
  var matFailure = calcTsaiWuFailurePressure(ABD, actualAngles, Qply, material, R, pressureDir, axialEnd);

  // ---- Step 4: 设计压力下的应力检查 ----
  var loadsDesign = calcCylinderLoads(pDesign, R, pressureDir, axialEnd);
  var TW = calcTsaiWuCoeffs({
    X_t_MPa: material.X_t_MPa, X_c_MPa: material.X_c_MPa,
    Y_t_MPa: material.Y_t_MPa, Y_c_MPa: material.Y_c_MPa,
    S_MPa: material.S_MPa
  });
  var strengths = {
    X_t_MPa: material.X_t_MPa, X_c_MPa: material.X_c_MPa,
    Y_t_MPa: material.Y_t_MPa, Y_c_MPa: material.Y_c_MPa,
    S_MPa: material.S_MPa
  };
  var designStresses = calcPlyStresses(ABD, actualAngles, Qply,
    loadsDesign.Nx, loadsDesign.Ny, TW, strengths);

  // ---- Step 5: 安全系数 ----
  var knockdown = 0.75;
  var SFbuckle = (pDesign > 0) ? toFixed3(buckling.p_cr_MPa * knockdown / pDesign) : Infinity;
  var SFmaterial = (pDesign > 0) ? toFixed3(matFailure.p_fail_MPa / pDesign) : Infinity;
  var SFbuckleQualified = SFbuckle >= 2.0 ? '合格' : (SFbuckle >= 1.5 ? '警告' : '不合格');
  var SFmaterialQualified = SFmaterial >= 2.0 ? '合格' : (SFmaterial >= 1.5 ? '警告' : '不合格');

  // ---- Step 6: 失效曲线图数据 ----
  var mapData = generateFailureMapData(R, L, material, plyAngles, t_ply,
    pressureDir, axialEnd, mapPoints, totalThick, pDesign);

  // ---- Step 7: 判定主导失效模式 ----
  var governingMode;
  var pBuckleDesign = buckling.p_cr_MPa * knockdown;
  if (pBuckleDesign < matFailure.p_fail_MPa) {
    governingMode = '屈曲失稳 (Buckling)';
  } else {
    governingMode = '材料强度失效 (Material Failure)';
  }

  return {
    error: false,
    input: {
      R_mm: R, L_mm: L, t_ply_mm: t_ply, n_layers: nLayers,
      totalThickness_mm: totalThick,
      plyAngles_deg: actualAngles,
      materialName: material.name || '自定义',
      materialObj: {
        E1_GPa: material.E1_GPa, E2_GPa: material.E2_GPa, G12_GPa: material.G12_GPa, nu12: material.nu12,
        X_t_MPa: material.X_t_MPa, X_c_MPa: material.X_c_MPa,
        Y_t_MPa: material.Y_t_MPa, Y_c_MPa: material.Y_c_MPa,
        S_MPa: material.S_MPa
      },
      pressureDir: pressureDir,
      endCondition: endCondition,
      axialEnd: axialEnd,
      p_design_MPa: pDesign
    },
    laminate: {
      ABD: ABD,
      effectiveConstants: effConst,
      Qply: Qply
    },
    buckling: {
      p_cr_MPa: buckling.p_cr_MPa,
      p_cr_design_MPa: toFixed3(buckling.p_cr_MPa * knockdown),
      n_cr: buckling.n_cr,
      m_cr: buckling.m_cr,
      knockdown: knockdown,
      allModes: buckling.allModes,
      formula: buckling.formula
    },
    materialFailure: {
      p_fail_MPa: matFailure.p_fail_MPa,
      criticalPly: matFailure.criticalPly,
      criticalAngle_deg: matFailure.criticalAngle_deg,
      failureMode: matFailure.failureMode,
      plyResults: matFailure.plyResults
    },
    designCheck: {
      plyStresses: designStresses,
      maxTW_atDesign: Math.max.apply(null, designStresses.map(function(s) { return s.twIndex || 0; }))
    },
    safetyFactors: {
      buckling: { SF: SFbuckle, qualified: SFbuckleQualified, threshold: 2.0, note: 'SF = p_cr×0.75/p_design' },
      material: { SF: SFmaterial, qualified: SFmaterialQualified, threshold: 2.0, note: 'SF = p_fail/p_design' }
    },
    governingMode: governingMode,
    failureMap: mapData,
    summary: '屈曲临界压力: ' + buckling.p_cr_MPa + ' MPa | 材料失效压力: ' + matFailure.p_fail_MPa +
             ' MPa | 安全系数: 屈曲=' + SFbuckle + ', 材料=' + SFmaterial +
             ' | 主导模式: ' + governingMode
  };
}
