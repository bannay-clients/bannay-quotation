'use strict';

const example = {
  creator: 'نور سالم (اسم تجريبي)',
  brand: 'استوديو مدار (براند تجريبي)',
  fee: '950',
  payment: 'خلال ٧ أيام من تسليم المقطعين واعتمادهما.',
  representative: ''
};

for (const [name, content] of Object.entries(example)) {
  form.querySelector('[name="' + name + '"]').value = content;
}
addClip({
  idea: 'عرض تجربة استخدام المنتج في روتين الصباح.',
  points: 'إظهار العبوة بوضوح. ذكر طريقة الاستخدام في بداية المقطع.',
  brief: 'https://example.com/ugc-brief',
  due: '2026-12-03',
  publish: 'yes',
  platform: 'إنستغرام'
});
addClip({
  idea: 'تصوير فتح العبوة وإبراز تفاصيل المنتج.',
  points: 'لقطات قريبة للمنتج. إظهار الملحقات المرفقة.',
  due: '2026-12-05',
  publish: 'no'
});
render();
