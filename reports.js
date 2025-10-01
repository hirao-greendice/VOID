// reports.js
// レポート定義をここに追加します。

(function () {
  const T = {
    // text(id, placeholder?, size?) OR text(id, {solution?, placeholder?, size?})
    text: (id, a, b, c) => {
      if (typeof a === 'object' && a !== null && !Array.isArray(a)) {
        const { solution = '', placeholder = '', size } = a;
        return { kind: 'text', id, solution, placeholder, size };
      } else {
        const placeholder = a || '';
        const size = b;
        const solution = c || undefined;
        return { kind: 'text', id, solution, placeholder, size };
      }
    },
    // choice(id, options, size?, placeholder?, solution?)
    // or choice(id, { options, size?, placeholder?, solution?, solutionIndex?, correctIndex? })
    choice: (id, a, b, c, d) => {
      if (Array.isArray(a)) {
        const options = a;
        let solution = d;
        if (typeof solution === 'number' && options[solution] !== undefined) solution = options[solution];
        return { kind: 'choice', id, options, size: b, placeholder: c, solution };
      } else {
        const { options = [], size, placeholder = undefined } = a || {};
        let { solution, solutionIndex, correctIndex } = a || {};
        if (typeof solution === 'number' && options[solution] !== undefined) solution = options[solution];
        if (solution == null && typeof solutionIndex === 'number' && options[solutionIndex] !== undefined) solution = options[solutionIndex];
        if (solution == null && typeof correctIndex === 'number' && options[correctIndex] !== undefined) solution = options[correctIndex];
        return { kind: 'choice', id, options, size, placeholder, solution };
      }
    }
  };

  // 〜カメラについて〜
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
              '①', T.choice('method', ['ダスシステム', 'ヌルシステム'], 20), 'で、素材',
              T.text('material', { solution: 'レンガ', size: 12, placeholder: '' }), 'を使って\n　',
              T.choice('cardS', { options: ['A','N','S','W','E','R'], size: 10, placeholder: '', solution: 'S' }), 'のカードの',
              T.text('fromColor', { solution: '青', size: 6, placeholder: '' }), '色を',
              T.text('toColor', { solution: '赤', size: 6, placeholder: '' }), '色に変えた。\n',
              '②向きを変えた', T.choice('cardN', { options: ['A','N','S','W','E','R'], size: 10, placeholder: '', solution: 'N' }), '/色を変えた',
              T.choice('cardS2', { options: ['A','N','S','W','E','R'], size: 10, placeholder: '', solution: 'S' }), '/',
              T.choice('cardE', { options: ['A','N','S','W','E','R'], size: 10, placeholder: '', solution: 'E' }), 'のカードに、\n　',
              '情報ボックス', T.choice('boxWhich', ['A', 'B'], 6), 'の謎で使用した',
              T.text('ni', { solution: 'ニ', size: 4, placeholder: '' }), ' ',
              T.text('tsu', { solution: 'ッ', size: 4, placeholder: '' }), ' ',
              T.text('ko', { solution: 'コ', size: 4, placeholder: '' }), 'の\n　',
              T.text('sheet', { solution: '透明シート', size: 18, placeholder: '' }), 'を重ねて、',
              T.text('knot', { solution: 'ノット', size: 12, placeholder: '' }), 'を示した。'
            ]
          },
          {
            tokens: [
              '\nつまり、判定カメラは',
              T.choice('judge1', ['カードそのもの', 'カードに書かれた文字'], 22),
              'ではなく',
              T.choice('judge2', ['カードそのもの', 'カードに書かれた文字'], 22),
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
              T.choice('sameOrDiff', ['同じ', '異なる'], 10), 'なので\n',
              '「６」の', T.choice('sixChange', ['向き', '色'], 6), 'を変えて８よりも大きい数「９」を示すことができる。\n',
              'しかし、アンドロイドは「８」を提出したにもかかわらず、\n',
              '第一の試練に', T.choice('result', ['敗北している', '敗北していない'], 18), '。'
            ]
          },
          {
            tokens: [
              '\nつまり、アンドロイドは「８」を使って最も',
              T.choice('bigSmall', ['大きい', '小さい'], 10),
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
              'アンドロイドは、「８」の', T.choice('infty', ['向き', '色'], 6), 'を変えて「∞」を示した。'
            ]
          }
        ]
      }
    ]
  };

  // 〜チーズについて〜
  const cheeseReport = {
    id: 'cheese',
    name: '違和感レポート 〜チーズについて〜',
    title: '違和感レポート',
    subtitle: '〜チーズについて〜',
    sections: [
      {
        title: '状況',
        blocks: [
          {
            title: '情報ボックスCについて',
            tokens: [
              '・相手の会場の実験室には、チーズが置いてある。\n\n',
              '・２つの会場にある実験室・保管庫にあるアイテムは、\n',
              '数字のパネルをのぞいて全て', T.choice('itemsSame', ['同じである', '異なる'], 16), '。\n\n',
              '・保管庫にあるモノは、ダスシステムでしか手に入れられない。\n\n',
              '・', T.text('onlyItem', 'あああ', 12), 'を呼び出すことができる謎は謎',
              T.text('onlyPuzzle', 'あああ', 8), 'しかない。\n',
              '謎', T.text('onlyPuzzle2', 'あああ', 8), 'の答えから指定できる素材は',
              T.text('onlyMaterial', 'あああ', 12), 'しかない。\n\n',
              '・アンドロイドは第三の試練をクリアしているので、\n',
              '情報ボックスCのパスワードを突き止めて', T.choice('foundPw', ['いる', 'いない'], 8), '。\n\n'
            ]
          },
          {
            title: '結論',
            tokens: [
              'アンドロイドは', T.text('notCall', 'あああ', 12), 'を呼び出さずにパスワードを突き止めている。'
            ]
          }
        ]
      },
      {
        title: '情報ボックスCの謎について',
        blocks: [
          {
            tokens: [
              '情報ボックスCを開けるための謎を解き明かすと、\n',
              'ダスシステムでアイテムを呼び出す指示が現れる。\n',
              'プレイヤーは謎を解いた結果、', T.text('playerAns', 'あああ', 10), 'という答えを導いた。\n\n',
              'アンドロイドが', T.text('playerAns_ref', 'あああ', 10), 'を呼び出していないということは、\n',
              '別のアイテムXを呼び出す指示が現れたと推測することができる。\n\n',
              'この推測が正しいとすれば、\n',
              'アンドロイドはアイテムXを呼び出しても、\n',
              'パスワードを突き止められる状況になったと考えられる。\n\n',
              '保管庫の様子を確認すると、\n',
              '次のような手順であれば、パスワードを突き止められる。\n\n'
            ]
          },
          {
            tokens: [
              '＜謎を解いた後のアンドロイドの行動＞\n',
              '①情報ボックスCを開けるための謎を解き明かして、\n',
              T.text('callX', 'あああ', 12), 'を呼び出す指示が現れる。\n',
              '②ダスシステムで、素材', T.text('matX', 'あああ', 10), 'を使って',
              T.text('itemX', 'あああ', 12), 'を呼び出す。\n',
              '③', T.choice('whereSee', ['保管庫', '実験室'], 10), 'にある',
              T.text('seeWhat', 'あああ', 10), 'をみる。\n\n'
            ]
          },
          {
            title: '結論',
            tokens: [
              'アンドロイドは、情報ボックスCを開けるための謎を解き明かして、\n',
              T.text('calledFinally', 'あああ', 12), 'を呼び出した。'
            ]
          }
        ]
      },
      {
        title: '情報ボックスCを開けるための謎について',
        blocks: [
          {
            tokens: [
              '謎の答えが、', T.text('answerA', 'あああ', 10), 'ではなく',
              T.text('answerB', 'あああ', 14), 'になったということは、プレイヤーとアンドロイドで解き方が',
              T.choice('solveSame', ['同じである', '異なる'], 14), '。\n\n',
              '謎５〜謎８の答えは、コクヨウセキ/シュウジン/チーズケーキ/スキャンで正しいので、\n',
              '答えが示す４箇所の場所にある指示は正しい。\n\n',
              'つまり、プレイヤーが導き出した', T.text('playerAnsAgain', 'あああ', 10), 'という答えと異なる答えを導くためには、\n',
              '４箇所の場所にある指示を無視するしかない。\n\n',
              '見つけ出した指示は３つある。\n',
              'この中で、その指示を無視することでアンドロイドが導き出した\n',
              T.text('androidAns', 'あああ', 14), 'という答えになる指示は、指示',
              T.text('whichInstr', 'あああ', 8), 'である。\n\n',
              'この指示', T.text('whichInstr2', 'あああ', 8), 'は、',
              T.text('instrBy', 'あああ', 12), 'による指示である。\n\n',
              'アンドロイドの情報によると、\n',
              'アンドロイドの五感は人間と', T.choice('senseSame', ['同じである', '異なる'], 14), 'ことがわかる。\n',
              'プレイヤーはこの指示を問題なく知覚できたことから、\n',
              'アンドロイドは指示', T.text('whichInstr3', 'あああ', 8), 'を知覚',
              T.choice('couldSense', ['できた', 'できなかった'], 16), 'と推測できる。\n\n'
            ]
          },
          {
            title: '結論',
            tokens: [
              'アンドロイドは、', T.text('notPerceive', 'あああ', 12), 'が知覚できない環境にいる。'
            ]
          }
        ]
      }
    ]
  };

  window.reports = [cameraReport, cheeseReport];
})();

