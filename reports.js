// reports.js
// レポート定義をここに追加します。

(function () {
  const T = {
    // text(id, placeholder?, size?) OR text(id, {solution?, placeholder?, size?, link?})
    text: (id, a, b, c) => {
      if (typeof a === 'object' && a !== null && !Array.isArray(a)) {
        const { solution = '', placeholder = '', size, link } = a;
        return { kind: 'text', id, solution, placeholder, size, link };
      } else {
        const placeholder = a || '';
        const size = b;
        const solution = c || undefined;
        return { kind: 'text', id, solution, placeholder, size };
      }
    },
    // choice(id, options, size?, placeholder?, solution?)
    // or choice(id, { options, size?, placeholder?, solution?, solutionIndex?, correctIndex?, link?, placeholderMode? })
    choice: (id, a, b, c, d) => {
      if (Array.isArray(a)) {
        const options = a;
        let solution = d;
        if (typeof solution === 'number' && options[solution] !== undefined) solution = options[solution];
        return { kind: 'choice', id, options, size: b, placeholder: c, solution };
      } else {
        const { options = [], size, placeholder = undefined, link, placeholderMode } = a || {};
        let { solution, solutionIndex, correctIndex } = a || {};
        if (typeof solution === 'number' && options[solution] !== undefined) solution = options[solution];
        if (solution == null && typeof solutionIndex === 'number' && options[solutionIndex] !== undefined) solution = options[solutionIndex];
        if (solution == null && typeof correctIndex === 'number' && options[correctIndex] !== undefined) solution = options[correctIndex];
        return { kind: 'choice', id, options, size, placeholder, solution, link, placeholderMode };
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
            title: '資料ケースBについて',
            tokens: [
              '資料ケースBを以下の方法で開けた。\n',
              '①', T.choice('method', ['ダスシステム', 'ヌルシステム'], 20), 'で、\n素材',
              T.text('material', { solution: 'レンガ', size: 12, placeholder: '' }), 'を使って、',
              T.choice('cardS', { options: ['A','N','S','W','E','R'], size: 10, placeholder: '', solution: 'S' }), 'のカードの',
              T.text('fromColor', { solution: '青', size: 6, placeholder: '' }), '色を',
              T.text('toColor', { solution: '赤', size: 6, placeholder: '' }), '色に変えた。\n',
              '②向きを変えた', T.choice('cardN', { options: ['A','N','S','W','E','R'], size: 10, placeholder: '', solution: 'N' }), '/色を変えた',
              T.choice('cardS2', { options: ['A','N','S','W','E','R'], size: 10, placeholder: '', solution: 'S' }), '/',
              T.choice('cardE', { options: ['A','N','S','W','E','R'], size: 10, placeholder: '', solution: 'E' }), 'のカードに、\n　',
              '資料ケース', T.choice('boxWhich', ['A', 'B'], 6), 'の謎で使用した',
              T.text('ni', { solution: 'ニ', size: 4, placeholder: '' }), ' ',
              T.text('tsu', { solution: 'ッ', size: 4, placeholder: '' }), ' ',
              T.text('ko', { solution: 'コ', size: 4, placeholder: '' }), 'の\n　',
              T.text('sheet', { solution: '透明シート', size: 18, placeholder: '' }), 'を重ねて、',
              T.text('knot', { solution: 'ノット', size: 12, placeholder: '' }), 'を示した。'
            ]
          },
          {
            tokens: [
              '\nつまり、判定カメラは\n真上から見える',
              T.choice('judge1', ['カードそのもの', '文字'], 22),
              'で判定しているのではなく、\n真上から見える',
              T.choice('judge2', ['カードそのもの', '文字'], 22),
              'を判定している。'
            ]
          },
          {
            tokens: [
              T.choice('judge1', ['カードそのもの', '文字'], 22),
              'はカードの',
              T.text('nin56', { solution: '色', size: 8, placeholder: '' }), 'や ',
              T.text('tsuwe', { solution: '向き', size: 8, placeholder: '' }), 'の変更をしたり、\n',
              T.text('ko123', { solution: '透明シート', size: 18, placeholder: '' }), 'を重ねたりしても問題なく判定される。'
            ]
          }
        ]
      },
      {
        
        blocks: [
          {
            title: '第一の試練について',
            tokens: [
              '第一の試練の際にみた映像を思い出してみると、\n',
              'アンドロイドは０・２・４・６・８の数字カードのうち、\n',
              '最も大きい数を示すために８を提出していた。\n\n'
            ]
          },
          {
            tokens: [
              'ところで、この会場にある判定カメラは全て',
              T.choice('sameOrDiff', ['同じ', '異なる'], 10), 'ため、\n先ほど判明した判定カメラの性質から、\n',
              '「6」の', T.choice('sixChange', ['向き', '色'], 6), 'を変えて８よりも大きい数',
              T.text('number9', { solution: '9', size: 4, placeholder: '' }),'を示すことができる。\n',
              'しかし、アンドロイドは',
              T.text('number8', { solution: '8', size: 4, placeholder: '' }),'を提出したにもかかわらず、\n',
              '第一の試練に', T.choice('result', ['敗北している', '敗北していない'], 18), '。'
            ]
          },
          {
            tokens: [
              '\nつまり、アンドロイドは',
              T.text('number8', { solution: '8', size: 4, placeholder: '' }),'を使って最も',
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
                'アンドロイドは、',
              T.text('number8', { solution: '8', size: 4, placeholder: '' }),'の', T.choice('infty', ['向き', '色'], 6), 'を変えて',
              T.text('number', { solution: '∞', size: 4, placeholder: '' }),'を示した。'
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
            title: '資料ケースCについて',
            tokens: [
              '・相手の会場の実験室には、チーズが置いてある。\n',
              '・２つの会場にある実験室・保管庫にあるアイテムは、\n',
              '数字のパネルをのぞいて全て', T.choice('itemsSame', { options: ['同じである', '異なる'], size: 16, placeholder: '' }), '。\n',
              '・保管庫にあるモノは、ダスシステムでしか手に入れられない。\n',
              '・「扇子」を呼び出すことができる謎は謎ID:',
              T.choice('riddle', { options: ['001','002','003','004','005','006','007','008','009','010'], size: 10, placeholder: '', solution: '001',placeholderMode: 'none',link: 'riddleid' }), 'しかない。\n',
              '謎ID:', T.choice('riddle', { options: ['001','002','003','004','005','006','007','008','009','010'], size: 10, placeholder: '', solution: '001',placeholderMode: 'none',link: 'riddleid' }), 'の答えから指定できる素材は',
              T.text('onlyMaterial', { solution: 'あああ', placeholder: '', size: 12 }), 'しかない。\n',
              '・アンドロイドは第三の試練をクリアしているので、\n',
              '資料ケースCのパスワードを突き止めて', T.choice('foundPw', { options: ['いる', 'いない'], size: 8, placeholder: '' }), '。\n'
            ]
          }
        ],
      },
      {
        title: '結論',
        blocks: [
          {
            tokens: [
              'アンドロイドは', T.text('notCall', { solution: 'あああ', placeholder: '', size: 12, link: 'android' }), 'を呼び出さずにパスワードを突き止めている。'
            ]
          }
        ]
      },
      {
        
        blocks: [
          {
            title: '資料ケースCの謎について',
            tokens: [
              '資料ケースCを開けるための謎を解き明かすと、\n',
              'ダスシステムでアイテムを呼び出す指示が現れる。\n',
              'プレイヤーは謎を解いた結果、', T.text('playerAns', { solution: 'あああ', placeholder: '', size: 10, link: 'sensu' }), 'という答えを導いた。\n',
              'つまり、アンドロイドが', T.text('playerAns_ref', { solution: 'あああ', placeholder: '', size: 10, link: 'android' }), 'を呼び出していないということは、\n',
              '別のアイテムXを呼び出す指示が現れたと推測することができる。\n',
              'この推測が正しいとすれば、\n',
              'アンドロイドはアイテムXを呼び出しても、\n',
              'パスワードを突き止められる状況になったと考えられる。\n',
              '保管庫の様子を確認すると、\n',
              '次のような手順であれば、パスワードを突き止められる。\n'
            ]
          },
          {
            tokens: [
              '＜謎を解いた後のアンドロイドの行動＞\n',
              '①資料ケースCを開けるための謎を解き明かして、\n',
              T.text('callX', { solution: 'あああ', placeholder: '', size: 12, link: 'androidcall' }), 'を呼び出す指示が現れる。\n',
              '②ダスシステムで、素材', T.text('matX', { solution: 'あああ', placeholder: '', size: 10 }), 'を使って',
              T.text('itemX', { solution: 'あああ', placeholder: '', size: 12, link: 'androidcall' }), 'を呼び出す。\n',
              '③', T.choice('whereSee', { options: ['保管庫', '実験室'], size: 10, placeholder: '' }), 'にある',
              T.text('seeWhat', { solution: 'あああ', placeholder: '', size: 10 }), 'をみる。\n'
            ]
          }
        ],
      },
      {
        title: '結論',
        blocks: [
          {
            tokens: [
              'アンドロイドは、資料ケースCを開けるための謎を解き明かして、\n',
              T.text('calledFinally', { solution: 'あああ', placeholder: '', size: 12, link: 'androidcall' }), 'を呼び出した。'
            ]
          }
        ]
      },
      {
        
        blocks: [
          {
            title: '資料ケースCを開けるための謎について',
            tokens: [
              '謎の答えが、', T.text('answerA', { solution: 'あああ', placeholder: '', size: 10, link: 'sensu' }), 'ではなく',
              T.text('answerB', { solution: 'あああ', placeholder: '', size: 14 , link: 'androidcall'}), 'になったということは、\nプレイヤーとアンドロイドで謎の解き方が',
              T.choice('solveSame', { options: ['同じである', '異なる'], size: 14, placeholder: '' }), '。\n',
              '謎ID:006〜謎ID:010の答えは、コクヨウセキ/チーズケーキ/スキャンで正しいので、\n',
              '謎の答えが示す5箇所の場所は正しい。\n',
              'つまり、プレイヤーの導き出した', T.text('playerAnsAgain', { solution: '扇子', placeholder: '', size: 10, link: 'sensu' }), 'という答えと異なる答えを導くためには、\n',
              '5箇所の場所にある指示のいくつかを無視するしかない。\n',
              '見つけ出した指示は4つある。\n',
              'この中で、その指示を無視することでアンドロイドが導き出した\n',
              T.text('androidAns', { solution: 'キャンバス', placeholder: '', size: 14, link: 'androidcall' }), 'という答えになる指示は、指示',
              T.choice('siji', { options: ['1','2','3','4'], size: 10, placeholder: '', solution: 'S',placeholderMode: 'none',link: 'siji' }),  'である。\n',
              'この指示', T.choice('siji', { options: ['1','2','3','4'], size: 10, placeholder: '', solution: 'S',placeholderMode: 'none',link: 'siji' }), 'は、',
              T.text('instrBy', { solution: 'あああ', placeholder: '', size: 12 }), 'による指示である。\n',
              'アンドロイドの情報によると、\n',
              'アンドロイドの五感は人間と', T.choice('senseSame', { options: ['同じである', '異なる'], size: 14, placeholder: '' }), 'ことがわかる。\n',
              'プレイヤーはこの指示を問題なく知覚できたことから、\n',
              'アンドロイドは指示', T.choice('siji', { options: ['1','2','3','4'], size: 10, placeholder: '', solution: 'S',placeholderMode: 'none',link: 'siji' }), 'を知覚',
              T.choice('couldSense', { options: ['できる', 'できない'], size: 16, placeholder: '' }), 'はずなのに、\n',
              T.choice('couldSens', { options: ['できた', 'できなかった'], size: 16, placeholder: '' }),'と推測できる。\n'
            ]
          }
        ],
      },
      {
        title: '結論',
        blocks: [
          {
            tokens: [
              'アンドロイドは、', T.text('notPerceive', { solution: 'あああ', placeholder: '', size: 12 }), 'が知覚できない環境にいる。'
            ]
          }
        ]
      }
    ]
  };

  window.reports = [cameraReport, cheeseReport];
})();
