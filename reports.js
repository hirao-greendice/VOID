// reports.js
// 追加しやすい設定ファイル。ここにレポート定義を増やしてください。

(function () {
  const T = {
    text: (id, placeholder, size) => ({ kind: 'text', id, placeholder, size }),
    choice: (id, options, size) => ({ kind: 'choice', id, options, size })
  };

  // 「カメラについて」
  const cameraReport = {
    id: 'camera',
    name: '違和感レポート 〜カメラについて〜',
    title: '違和感レポート',
    subtitle: '〜カメラについて〜',
    sections: [
      {
        title: '状況',
        blocks: [
          {
            title: '情報ボックスBについて',
            tokens: [
              '情報ボックスBを以下の方法で開けた。\n',
              '①', T.choice('method', ['ダスシステム', 'ヌルシステム'], 8), 'で、素材「',
              T.text('material', 'レンガ', 4), '」を使って\n　「',
              T.text('cardS', 'S', 1), '」のカードの「',
              T.text('fromColor', '青', 2), '」色を「',
              T.text('toColor', '赤', 2), '」色に変えた。\n',
              '②向きを変えた「', T.text('cardN', 'N', 1), '」/色を変えた「',
              T.text('cardS2', 'S', 1), '」/「', T.text('cardE', 'E', 1), '」のカードに、\n　',
              '情報ボックス', '（', T.choice('boxWhich', ['A', 'B'], 1), '）',
              'の謎で使用した「', T.text('ni', 'ニ', 1), '」「', T.text('tsu', 'ッ', 1), '」「',
              T.text('ko', 'コ', 1), '」の\n　「', T.text('sheet', '透明シート', 6), '」を重ねて、',
              T.text('knot', 'ノット', 3), 'を示した。'
            ]
          },
          {
            tokens: [
              '\nつまり、判定カメラは',
              '（', T.choice('judge1', ['カードそのもの', 'カードに書かれた文字'], 10), '）',
              'ではなく',
              '（', T.choice('judge2', ['カードそのもの', 'カードに書かれた文字'], 10), '）',
              'を判定している。'
            ]
          }
        ]
      },
      {
        title: '第一の試練について',
        blocks: [
          {
            tokens: [
              '第一の試練の際にみた映像を思い出してみると、\n',
              'アンドロイドは０・２・４・６・８の数字カードのうち、\n',
              '最も大きい数を示すために８を提出していた。\n\n'
            ]
          },
          {
            tokens: [
              'ところで、この会場にある判定カメラは全て',
              '（', T.choice('sameOrDiff', ['同じ', '異なる'], 20), '）', 'なので\n',
              '「６」の', '（', T.choice('sixChange', ['向き', '色'], 2), '）',
              'を変えて８よりも大きい数「９」を示すことができる。\n',
              'しかし、アンドロイドは「８」を提出したにもかかわらず、\n',
              '第一の試練に', '（', T.choice('result', ['敗北している', '敗北していない'], 8), '）', '。'
            ]
          },
          {
            tokens: [
              '\nつまり、アンドロイドは「８」を使って最も',
              '（', T.choice('bigSmall', ['大きい', '小さい'], 3), '）',
              '数を示していることがわかる。'
            ]
          }
        ]
      },
      {
        title: '結論',
        blocks: [
          {
            tokens: [
              'アンドロイドは、「８」の', '（', T.choice('infty', ['向き', '色'], 2), '）',
              'を変えて「∞」を示した。'
            ]
          }
        ]
      }
    ]
  };

  // ここに別のレポートを追加する場合は、
  // `reports` 配列に同様のオブジェクトを push してください。
  window.reports = [cameraReport];
})();

