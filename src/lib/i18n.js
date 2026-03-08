// Bilingual strings — Arabic / English
// Usage: t('key', lang) where lang = 'ar' | 'en'

export const strings = {
  // Nav
  dashboard:    { ar: 'لوحة التحكم',    en: 'Dashboard'    },
  analytics:    { ar: 'التحليلات',       en: 'Analytics'    },
  forecast:     { ar: 'التنبؤ',          en: 'Forecast'     },
  operations:   { ar: 'العمليات',        en: 'Operations'   },
  import_data:  { ar: 'استيراد البيانات',en: 'Import Data'  },
  transform:    { ar: 'تحويل الملفات',   en: 'Transform'    },
  users:        { ar: 'المستخدمون',      en: 'Users'        },
  sign_out:     { ar: 'تسجيل الخروج',   en: 'Sign Out'     },

  // Forecast
  generate_forecast:  { ar: 'توليد التنبؤ',      en: 'Generate Forecast'   },
  regenerate:         { ar: 'إعادة التوليد',      en: 'Regenerate'          },
  generating:         { ar: 'جارٍ التوليد…',     en: 'Generating…'         },
  weekly_plan:        { ar: 'خطة الأسبوع',        en: 'Weekly Plan'         },
  cook_plan:          { ar: 'خطة الطهي',          en: 'Cook Plan'           },
  overview:           { ar: 'نظرة عامة',          en: 'Overview'            },
  heatmap:            { ar: 'خريطة الطلب',        en: 'Demand Heatmap'      },
  run_history:        { ar: 'سجل التشغيل',        en: 'Run History'         },
  accuracy:           { ar: 'الدقة',              en: 'Accuracy'            },
  training:           { ar: 'ضبط النموذج',        en: 'Model Training'      },
  no_forecast:        { ar: 'لا يوجد تنبؤ لهذا اليوم', en: 'No forecast for this date' },
  confidence_high:    { ar: 'عالية',              en: 'High'                },
  confidence_med:     { ar: 'متوسطة',             en: 'Medium'              },
  confidence_low:     { ar: 'منخفضة',             en: 'Low'                 },
  predicted_p50:      { ar: 'الطلب المتوقع P50',  en: 'Predicted Demand P50'},
  safety_p80:         { ar: 'الهامش الآمن P80',   en: 'Safety Stock P80'    },
  observed_rows:      { ar: 'صفوف مرصودة',        en: 'Observed Rows'       },
  bootstrap_rows:     { ar: 'صفوف تقديرية',       en: 'Bootstrap Rows'      },
  recommended_batches:{ ar: 'الدفعات الموصى بها', en: 'Recommended Batches' },
  margin_error:       { ar: 'هامش الخطأ',         en: 'Margin of Error'     },
  low_estimate:       { ar: 'التقدير الأدنى',      en: 'Low Estimate'        },
  high_estimate:      { ar: 'التقدير الأعلى',     en: 'High Estimate'       },
  print_sheet:        { ar: 'طباعة الجدول',       en: 'Print Sheet'         },
  all_branches:       { ar: 'جميع الفروع',        en: 'All Branches'        },
  all_products:       { ar: 'جميع المنتجات',      en: 'All Products'        },

  // Operations
  log_batch:          { ar: 'تسجيل دفعة',         en: 'Log Batch'           },
  log_waste:          { ar: 'تسجيل هدر',          en: 'Log Waste'           },
  log_stockout:       { ar: 'تسجيل نفاد',         en: 'Log Stockout'        },
  branch:             { ar: 'الفرع',              en: 'Branch'              },
  product:            { ar: 'المنتج',             en: 'Product'             },
  time_slot:          { ar: 'الفترة الزمنية',     en: 'Time Slot'           },
  quantity_kg:        { ar: 'الكمية (كجم)',       en: 'Quantity (kg)'       },
  waste_reason:       { ar: 'سبب الهدر',          en: 'Waste Reason'        },
  save:               { ar: 'حفظ',               en: 'Save'                },
  saved:              { ar: 'تم الحفظ',           en: 'Saved'               },
  hot_hold_expired:   { ar: 'انتهى وقت الاحتفاظ',en: 'Hot Hold Expired'    },
  overproduction:     { ar: 'إنتاج زائد',        en: 'Overproduction'      },
  damaged:            { ar: 'تالف',              en: 'Damaged'             },
  other:              { ar: 'أخرى',              en: 'Other'               },

  // Dashboard
  waste_pct:          { ar: '% الهدر اليوم',     en: 'Waste % Today'       },
  batches_today:      { ar: 'دفعات اليوم',       en: 'Batches Today'       },
  stockouts_today:    { ar: 'نفاد اليوم',        en: 'Stockouts Today'     },
  active_branches:    { ar: 'الفروع النشطة',     en: 'Active Branches'     },
  last_7_days:        { ar: 'آخر 7 أيام',        en: 'Last 7 Days'         },
  today:              { ar: 'اليوم',             en: 'Today'               },

  // Charts
  revenue:            { ar: 'الإيرادات',         en: 'Revenue'             },
  cogs:               { ar: 'تكلفة المبيعات',    en: 'COGS'                },
  profit:             { ar: 'الربح',             en: 'Profit'              },
  units_sold:         { ar: 'الوحدات المباعة',   en: 'Units Sold'          },
  actual:             { ar: 'الفعلي',            en: 'Actual'              },
  predicted:          { ar: 'المتوقع',           en: 'Predicted'           },
}

export function t(key, lang = 'ar') {
  return strings[key]?.[lang] ?? strings[key]?.en ?? key
}

export function useLang() {
  if (typeof window === 'undefined') return 'ar'
  return localStorage.getItem('lang') || 'ar'
}
