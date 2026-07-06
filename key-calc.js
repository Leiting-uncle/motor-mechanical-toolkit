/**
 * ============================================================
 * key-calc.js — 平键核心计算层
 * 依据：GB/T 1096-2003《普通型 平键》
 *       《机械设计手册》第五版 第2卷
 *
 * 职责：仅存放纯计算函数、校核逻辑
 * 禁止：任何 DOM 操作、界面交互代码
 *
 * 默认单位：长度 mm，转矩 N·m，应力 MPa
 * 所有函数均为纯函数，相同输入永远得到相同输出
 * ============================================================
 */

// ============================================================
// 一、键尺寸查询
// ============================================================

/**
 * 根据轴径查询标准键截面尺寸
 * 依据：GB/T 1096-2003 表1 — 键和键槽的剖面尺寸
 *
 * @param {number} shaftDiameter - 轴径 (mm)
 * @returns {object} 标准键尺寸 {b, h, t1, t2, Lmin, Lmax, dRange}，超范围返回null
 */
function getKeyDimensions(shaftDiameter) {
  for (let i = 0; i < KEY_DIMENSIONS.length; i++) {
    const dim = KEY_DIMENSIONS[i];
    if (shaftDiameter > dim.dMin && shaftDiameter <= dim.dMax) {
      return {
        found: true,
        b: dim.b,                    // 键宽 (mm)
        h: dim.h,                    // 键高 (mm)
        t1: dim.t1,                  // 轴上键槽深度 (mm)
        t2: dim.t2,                  // 轮毂键槽深度 (mm)
        dRange: `${dim.dMin} < d ≤ ${dim.dMax}`,
        Lmin: dim.Lmin,              // 推荐最小长度 (mm)
        Lmax: dim.Lmax,              // 推荐最大长度 (mm)
        dMin: dim.dMin,
        dMax: dim.dMax,
        _index: i
      };
    }
  }

  // 超出标准范围
  const minD = KEY_DIMENSIONS[0].dMin;
  const maxD = KEY_DIMENSIONS[KEY_DIMENSIONS.length - 1].dMax;

  return {
    found: false,
    b: 0, h: 0, t1: 0, t2: 0,
    dRange: '',
    Lmin: 0, Lmax: 0,
    error: shaftDiameter <= minD
      ? `轴径 d=${shaftDiameter}mm 小于标准最小轴径 ${minD}mm，请检查输入`
      : `轴径 d=${shaftDiameter}mm 超过标准最大轴径 ${maxD}mm，请按非标设计`,
    dMin: 0, dMax: 0
  };
}

/**
 * 标准键长度取整（就近取标准系列值）
 * @param {number} length - 期望键长 (mm)
 * @returns {number} 就近的标准键长
 */
function getStandardKeyLength(length) {
  if (length <= KEY_LENGTH_SERIES[0]) return KEY_LENGTH_SERIES[0];
  if (length >= KEY_LENGTH_SERIES[KEY_LENGTH_SERIES.length - 1])
    return KEY_LENGTH_SERIES[KEY_LENGTH_SERIES.length - 1];

  let closest = KEY_LENGTH_SERIES[0];
  let minDiff = Math.abs(length - closest);
  for (let i = 1; i < KEY_LENGTH_SERIES.length; i++) {
    const diff = Math.abs(length - KEY_LENGTH_SERIES[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closest = KEY_LENGTH_SERIES[i];
    }
  }
  return closest;
}

// ============================================================
// 二、工作长度计算
// ============================================================

/**
 * 计算键的有效工作长度
 *
 * A型（圆头）：l_work = L - b        — 两端圆弧过渡，弧段不计入工作长度
 * B型（方头）：l_work = L            — 全长方头承载
 * C型（单圆头）：l_work = L - b/2    — 仅一端圆弧扣除
 *
 * @param {number} L - 键全长 (mm)
 * @param {number} b - 键宽 (mm)
 * @param {string} keyType - 键型 ('A'|'B'|'C')
 * @returns {object} { l_work, formula }
 */
function calcWorkingLength(L, b, keyType) {
  let l_work;
  let formula;

  switch (keyType) {
    case 'A':
      l_work = L - b;
      formula = `l_work = L - b = ${L} - ${b} = ${l_work} mm`;
      break;
    case 'B':
      l_work = L;
      formula = `l_work = L = ${L} mm`;
      break;
    case 'C':
      l_work = L - b / 2;
      formula = `l_work = L - b/2 = ${L} - ${b}/2 = ${l_work} mm`;
      break;
    default:
      l_work = L - b;  // 默认按A型
      formula = `l_work = L - b = ${L} - ${b} = ${l_work} mm (默认A型)`;
  }

  return {
    l_work_mm: l_work,
    _l_work: l_work,
    formula: formula,
    isNegative: l_work <= 0
  };
}

// ============================================================
// 三、强度校核计算
// ============================================================

/**
 * 校核键的剪切强度
 * 依据：《机械设计手册》第五版 第2卷 公式 6-2-1
 *
 * 键受剪力 F_t = 2T/d，剪切面积 A = b·l_work
 * τ = F_t / A = 2T / (d·b·l_work)
 *
 * @param {number} torque - 传递转矩 (N·m)
 * @param {number} d - 轴径 (mm)
 * @param {number} b - 键宽 (mm)
 * @param {number} l_work - 工作长度 (mm)
 * @returns {object} 剪切校核结果
 */
function checkKeyShear(torque, d, b, l_work) {
  if (l_work <= 0 || b <= 0 || d <= 0) {
    return {
      tau_MPa: 0,
      _tau: 0,
      error: true,
      message: '无效几何参数：工作长度/键宽/轴径必须大于0'
    };
  }

  // τ = 2T/d / (b·l_work) = 2T/(d·b·l_work)
  // T 单位 N·m → N·mm 乘 1000
  const tau = (2000 * torque) / (d * b * l_work);

  return {
    tau_MPa: toSignificantDigits ? toSignificantDigits(tau) : parseFloat(tau.toPrecision(6)),
    _tau: tau,
    F_t_N: (2000 * torque) / d,   // 切向力
    formula: 'τ = 2T / (d·b·l_work)',
    error: false
  };
}

/**
 * 校核轮毂键槽挤压强度
 * 依据：《机械设计手册》第五版 第2卷 公式 6-2-2
 *
 * 接触高度 k = h - t1（键高出轴表面部分，即与毂接触高度）
 * σ_p_hub = F_t / (k·l_work) = 2T / (d·k·l_work)
 *
 * @param {number} torque - 传递转矩 (N·m)
 * @param {number} d - 轴径 (mm)
 * @param {number} h - 键高 (mm)
 * @param {number} t1 - 轴上键槽深 (mm)
 * @param {number} l_work - 工作长度 (mm)
 * @returns {object} 轮毂挤压校核结果
 */
function checkHubCrushing(torque, d, h, t1, l_work) {
  const k = h - t1;   // 键与轮毂的接触高度 (mm)

  if (k <= 0 || l_work <= 0 || d <= 0) {
    return {
      sigma_p_MPa: 0,
      _sigma_p: 0,
      k_mm: k,
      error: true,
      message: k <= 0 ? '接触高度 k=h-t1 ≤ 0，参数异常' : '无效几何参数'
    };
  }

  // σ_p = 2T/d / (k·l_work) = 2T/(d·k·l_work)
  const sigma_p = (2000 * torque) / (d * k * l_work);

  return {
    sigma_p_MPa: toSignificantDigits ? toSignificantDigits(sigma_p) : parseFloat(sigma_p.toPrecision(6)),
    _sigma_p: sigma_p,
    k_mm: k,
    formula: 'σ_p(毂) = 2T / (d·k·l_work), k = h - t1',
    error: false
  };
}

/**
 * 校核轴上键槽挤压强度
 * 依据：《机械设计手册》第五版 第2卷
 *
 * 接触高度 = t1（轴上键槽深度，键埋入轴中部分）
 * σ_p_shaft = F_t / (t1·l_work) = 2T / (d·t1·l_work)
 *
 * 注意：通常轴材料强度 ≥ 键材料强度，此项一般不起控制作用
 *
 * @param {number} torque - 传递转矩 (N·m)
 * @param {number} d - 轴径 (mm)
 * @param {number} t1 - 轴上键槽深 (mm)
 * @param {number} l_work - 工作长度 (mm)
 * @returns {object} 轴键槽挤压校核结果
 */
function checkShaftCrushing(torque, d, t1, l_work) {
  if (t1 <= 0 || l_work <= 0 || d <= 0) {
    return {
      sigma_p_MPa: 0,
      _sigma_p: 0,
      error: true,
      message: '无效几何参数'
    };
  }

  const sigma_p = (2000 * torque) / (d * t1 * l_work);

  return {
    sigma_p_MPa: toSignificantDigits ? toSignificantDigits(sigma_p) : parseFloat(sigma_p.toPrecision(6)),
    _sigma_p: sigma_p,
    formula: 'σ_p(轴) = 2T / (d·t1·l_work)',
    error: false
  };
}

// ============================================================
// 四、功率→转矩换算
// ============================================================

/**
 * 从功率和转速计算传递转矩
 * 公式：T = 9550 × P / n
 * 来源：《机械设计手册》第五版 第1卷
 *
 * @param {number} power_kW - 传递功率 (kW)
 * @param {number} speed_rpm - 转速 (rpm)
 * @returns {number} 转矩 (N·m)，若转速≤0返回0
 */
function calcKeyTorqueFromPower(power_kW, speed_rpm) {
  if (speed_rpm <= 0 || power_kW <= 0) return 0;
  return 9550 * power_kW / speed_rpm;
}

// ============================================================
// 五、通用校核判定
// ============================================================

/**
 * 评定安全系数
 * @param {number} actual - 实际应力 (MPa)
 * @param {number} allowable - 许用应力 (MPa)
 * @param {number} qualified - 合格阈值
 * @param {number} warning - 警告阈值
 * @returns {object} { safetyFactor, status, allowable }
 */
function evaluateKeyCheck(actual, allowable, qualified, warning) {
  if (actual <= 0 || allowable <= 0) {
    return { safetyFactor: null, status: 'N/A', allowable };
  }
  const sf = allowable / actual;
  let status;
  if (sf >= qualified) status = '合格';
  else if (sf >= warning) status = '警告';
  else status = '不合格';
  return {
    safetyFactor: toSignificantDigits ? toSignificantDigits(sf) : parseFloat(sf.toPrecision(6)),
    _safetyFactor: sf,
    allowable: allowable,
    status: status,
    threshold: { qualified, warning }
  };
}

// ============================================================
// 六、综合计算入口
// ============================================================

/**
 * 平键联接综合强度校核
 *
 * @param {object} params - 输入参数
 * @param {number} params.shaftDiameter - 轴径 d (mm)
 * @param {string} params.keyType - 键型 ('A'|'B'|'C')
 * @param {number} params.keyLength - 键全长 L (mm)，为0时按推荐值
 * @param {number} params.torque - 传递转矩 T (N·m)，直接输入
 * @param {number} params.power_kW - 传递功率 P (kW)
 * @param {number} params.speed_rpm - 转速 n (rpm)
 * @param {string} params.hubMaterial - 轮毂材料 ('steel'|'castIron')
 * @param {string} params.loadType - 载荷类型 ('static'|'lightImpact'|'heavyImpact')
 * @param {string} params.keyMaterial - 键材料 ('45钢'|'40Cr'|'35钢')，影响剪切许用值判断
 * @param {object} [params.customAllow] - 自定义许用应力 { sigma_p, tau }，提供时覆盖查表值
 * @param {string} [params.customHubName] - 自定义轮毂材料名称
 * @param {string} [params.customKeyName] - 自定义键材料名称
 * @returns {object} 完整校核结果
 */
function calcFlatKey(params) {
  const {
    shaftDiameter,
    keyType = 'A',
    keyLength = 0,
    torque = 0,
    power_kW = 0,
    speed_rpm = 0,
    hubMaterial = 'steel',
    loadType = 'static',
    keyMaterial = '45钢',
    customAllow = null,
    customHubName = null,
    customKeyName = null
  } = params;

  // ===== Step 1: 查询标准键尺寸 =====
  const keyDim = getKeyDimensions(shaftDiameter);

  if (!keyDim.found) {
    return {
      error: true,
      message: keyDim.error,
      input: params,
      shaftDiameter
    };
  }

  const { b, h, t1, t2, Lmin, Lmax, dRange } = keyDim;

  // ===== Step 2: 键长确定 =====
  let L = keyLength;
  let lengthSource = '用户指定';
  const recommendedLength = getStandardKeyLength(shaftDiameter * 1.5);
  const minLength = Math.max(Lmin, shaftDiameter * 1.0);  // 按标准最小长度或1倍轴径
  const maxLength = Math.min(Lmax, shaftDiameter * 2.5);  // 按标准最大长度或2.5倍轴径

  if (L <= 0) {
    L = recommendedLength;
    lengthSource = `自动推荐（1.5d → 取标准值）`;
  }

  // ===== Step 3: 工作长度 =====
  const workLen = calcWorkingLength(L, b, keyType);

  if (workLen.isNegative) {
    return {
      error: true,
      message: `工作长度 l_work=${workLen.l_work_mm}mm ≤ 0，键长L=${L}mm必须大于键宽b=${b}mm（A型/C型）`,
      input: params
    };
  }

  const l_work = workLen._l_work;

  // ===== Step 4: 转矩确定 =====
  let effectiveTorque = torque;
  let torqueSource = '直接输入';
  if (effectiveTorque <= 0 && power_kW > 0 && speed_rpm > 0) {
    effectiveTorque = calcKeyTorqueFromPower(power_kW, speed_rpm);
    torqueSource = `由 P=${power_kW}kW, n=${speed_rpm}rpm 推算 (T=9550·P/n)`;
  }

  // ===== Step 5: 载荷与许用应力 =====
  const loadData = LOAD_TYPES[loadType];
  if (!loadData) {
    return { error: true, message: `未知载荷类型: ${loadType}` };
  }

  const hubMatData = HUB_MATERIALS[hubMaterial];
  if (!hubMatData) {
    return { error: true, message: `未知轮毂材料: ${hubMaterial}` };
  }

  const keyMatData = KEY_MATERIALS[keyMaterial] || KEY_MATERIALS['45钢'];

  // 许用值
  let allowable_sigma_p_hub, allowable_tau;

  if (customAllow) {
    // 自定义许用应力覆盖
    allowable_sigma_p_hub = customAllow.sigma_p > 0 ? customAllow.sigma_p
      : (hubMaterial === 'steel' ? loadData.hubSteel_sigma_p.value : loadData.hubCastIron_sigma_p.value);
    allowable_tau = customAllow.tau > 0 ? customAllow.tau : loadData.shear_tau.value;
  } else {
    allowable_sigma_p_hub = hubMaterial === 'steel'
      ? loadData.hubSteel_sigma_p.value
      : loadData.hubCastIron_sigma_p.value;
    allowable_tau = loadData.shear_tau.value;
  }

  // 自定义材料名称
  const hubDisplayName = customHubName || hubMatData.name;
  const keyDisplayName = customKeyName || keyMatData.name;

  // ===== Step 6: 强度校核 =====
  let strengthResult = null;

  if (effectiveTorque > 0) {
    // ① 键剪切强度
    const shearResult = checkKeyShear(effectiveTorque, shaftDiameter, b, l_work);
    const shearEval = evaluateKeyCheck(
      shearResult._tau, allowable_tau,
      KEY_SAFETY_THRESHOLDS.shear.qualified, KEY_SAFETY_THRESHOLDS.shear.warning
    );

    // ② 轮毂键槽挤压强度
    const hubCrushResult = checkHubCrushing(effectiveTorque, shaftDiameter, h, t1, l_work);
    const hubCrushEval = evaluateKeyCheck(
      hubCrushResult._sigma_p, allowable_sigma_p_hub,
      KEY_SAFETY_THRESHOLDS.crushing.qualified, KEY_SAFETY_THRESHOLDS.crushing.warning
    );

    // ③ 轴键槽挤压强度（通常用轮毂同档材料判据）
    const shaftCrushResult = checkShaftCrushing(effectiveTorque, shaftDiameter, t1, l_work);
    const shaftCrushEval = evaluateKeyCheck(
      shaftCrushResult._sigma_p, allowable_sigma_p_hub,
      KEY_SAFETY_THRESHOLDS.crushing.qualified, KEY_SAFETY_THRESHOLDS.crushing.warning
    );

    // 键长/轴径比检查
    const lengthRatio = L / shaftDiameter;
    const lengthAdvice = lengthRatio > KEY_SAFETY_THRESHOLDS.lengthCheck.maxRatio
      ? `键长/轴径=${lengthRatio.toFixed(1)} > ${KEY_SAFETY_THRESHOLDS.lengthCheck.maxRatio}，键过长，可能浪费材料`
      : (lengthRatio < 1.0
        ? `键长/轴径=${lengthRatio.toFixed(1)} < 1.0，建议增长键长或改用双键`
        : `键长/轴径=${lengthRatio.toFixed(1)}，长度合理`);

    strengthResult = {
      torque_Nm: parseFloat(effectiveTorque.toPrecision(6)),
      torqueSource,

      // ① 剪切
      shear: {
        stress_MPa: shearResult.tau_MPa,
        _stress: shearResult._tau,
        F_t_N: parseFloat(shearResult.F_t_N.toPrecision(6)),
        allowable_MPa: shearEval.allowable,
        safetyFactor: shearEval.safetyFactor,
        status: shearEval.status,
        threshold: shearEval.threshold,
        formula: shearResult.formula
      },
      // ② 轮毂挤压
      hubCrushing: {
        stress_MPa: hubCrushResult.sigma_p_MPa,
        _stress: hubCrushResult._sigma_p,
        k_mm: hubCrushResult.k_mm,
        allowable_MPa: hubCrushEval.allowable,
        safetyFactor: hubCrushEval.safetyFactor,
        status: hubCrushEval.status,
        threshold: hubCrushEval.threshold,
        formula: hubCrushResult.formula
      },
      // ③ 轴键槽挤压
      shaftCrushing: {
        stress_MPa: shaftCrushResult.sigma_p_MPa,
        _stress: shaftCrushResult._sigma_p,
        allowable_MPa: shaftCrushEval.allowable,
        safetyFactor: shaftCrushEval.safetyFactor,
        status: shaftCrushEval.status,
        threshold: shaftCrushEval.threshold,
        formula: shaftCrushResult.formula,
        note: '轴键槽挤压强度通常不起控制作用（轴材料≥键材料），仅供参考'
      },

      // 综合信息
      loadType: loadData.name,
      loadDescription: loadData.description,
      hubMaterial: hubDisplayName,
      hubMaterialDescription: customHubName ? '自定义轮毂材料' : hubMatData.description,
      keyMaterial: keyDisplayName,
      keyMaterialDescription: customKeyName ? '自定义键材料' : keyMatData.description,

      // 许用值范围
      allowable: {
        shear_tau_range: loadData.shear_tau.range,
        shear_tau: allowable_tau,
        crushing_sigma_p_range: hubMaterial === 'steel'
          ? loadData.hubSteel_sigma_p.range
          : loadData.hubCastIron_sigma_p.range,
        crushing_sigma_p: allowable_sigma_p_hub
      },

      lengthAdvice: lengthAdvice,
      lengthRatio: parseFloat(lengthRatio.toPrecision(3))
    };
  }

  // ===== 汇总输出 =====
  // 保留3位有效数字的辅助函数（内联，避免依赖外部）
  function sig(v, n = 6) {
    if (v === 0) return 0;
    if (Math.abs(v) < 1e-10) return 0;
    const d = Math.ceil(Math.log10(Math.abs(v)));
    const power = n - d;
    const magnitude = Math.pow(10, power);
    return Math.round(v * magnitude) / magnitude;
  }

  return {
    error: false,

    // 输入回显
    input: {
      shaftDiameter,
      keyType,
      keyTypeName: KEY_TYPES[keyType].name,
      keyLength: L,
      lengthSource,
      torque: effectiveTorque,
      torqueSource,
      hubMaterial: hubDisplayName,
      loadType: loadData.name,
      keyMaterial: keyDisplayName
    },

    // 键几何参数
    keyGeometry: {
      b, h, t1, t2,
      dRange,
      L,
      Lmin, Lmax,
      recommendedLength,
      l_work: sig(l_work),
      _l_work: l_work,
      contactHeight_k: sig(h - t1),       // 键与轮毂接触高度
      lengthRatio: L > 0 ? sig(L / shaftDiameter) : 0,
      lengthAdvice: strengthResult ? strengthResult.lengthAdvice : null
    },

    // 载荷与许用值
    loadInfo: {
      loadType: loadData.name,
      loadDescription: loadData.description,
      hubMaterial: hubDisplayName,
      hubMaterialHint: customHubName ? '自定义轮毂材料' : hubMatData.hint,
      keyMaterial: keyDisplayName,
      allowableShearStress_tau: allowable_tau,
      allowableShearStress_range: loadData.shear_tau.range,
      allowableCrushingStress_sigma_p: allowable_sigma_p_hub,
      allowableCrushingStress_range: hubMaterial === 'steel'
        ? loadData.hubSteel_sigma_p.range
        : loadData.hubCastIron_sigma_p.range
    },

    // 强度校核
    strength: strengthResult
  };
}

// ============================================================
// 七、导出
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getKeyDimensions,
    getStandardKeyLength,
    calcWorkingLength,
    checkKeyShear,
    checkHubCrushing,
    checkShaftCrushing,
    calcKeyTorqueFromPower,
    evaluateKeyCheck,
    calcFlatKey
  };
}
