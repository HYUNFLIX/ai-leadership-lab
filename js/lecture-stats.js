/* 강의 이력 화면의 순수 계산 — 요약, 월별 합계, 자동완성 후보. DOM을 건드리지 않는다.
 * 브라우저: window.LectureStats / Node 테스트: require(...)
 */
(function (root) {
  // lectures.html의 calculateNetPayment와 같은 식
  function calculateNetPayment(fee, taxDeduction) {
    if (!fee || fee <= 0) return 0;
    switch (taxDeduction) {
      case '3.3': return Math.round(fee * 0.967);
      case '8.8': return Math.round(fee * 0.912);
      case 'vat': return Math.round(fee * 1.1);
      default: return fee;
    }
  }

  function netPaymentOf(lecture) {
    return lecture.netPayment || calculateNetPayment(lecture.fee || 0, lecture.taxDeduction);
  }

  // 일부입금은 받은 금액을 따로 기록하지 않으므로 전액을 미수로 본다
  function isOutstanding(lecture) {
    return lecture.paymentStatus === 'pending' || lecture.paymentStatus === 'partial';
  }

  function summarize(lectures) {
    var out = { count: lectures.length, sumFee: 0, sumNet: 0, sumHours: 0, outstandingCount: 0, outstandingNet: 0 };
    lectures.forEach(function (l) {
      var net = netPaymentOf(l);
      out.sumFee += l.fee || 0;
      out.sumNet += net;
      out.sumHours += Number(l.duration) || 0;
      if (isOutstanding(l)) {
        out.outstandingCount += 1;
        out.outstandingNet += net;
      }
    });
    return out;
  }

  function monthlyTotals(lectures, year) {
    var months = [];
    for (var m = 1; m <= 12; m++) months.push({ month: (m < 10 ? '0' : '') + m, count: 0, sumFee: 0, sumNet: 0 });
    lectures.forEach(function (l) {
      var date = l.date || '';
      if (date.slice(0, 4) !== String(year)) return;
      var index = parseInt(date.slice(5, 7), 10) - 1;
      if (!(index >= 0 && index < 12)) return;
      months[index].count += 1;
      months[index].sumFee += l.fee || 0;
      months[index].sumNet += netPaymentOf(l);
    });
    return months;
  }

  function suggestions(lectures, field, limit) {
    var counts = {};
    lectures.forEach(function (l) {
      var value = typeof l[field] === 'string' ? l[field].trim() : '';
      if (value) counts[value] = (counts[value] || 0) + 1;
    });
    return Object.keys(counts)
      .sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b, 'ko'); })
      .slice(0, limit || 50);
  }

  var api = { netPaymentOf: netPaymentOf, isOutstanding: isOutstanding, summarize: summarize, monthlyTotals: monthlyTotals, suggestions: suggestions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LectureStats = api;
})(typeof window !== 'undefined' ? window : this);
