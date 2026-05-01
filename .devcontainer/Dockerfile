# Bun 1.3 があらかじめ入っている公式イメージをベースにする。
# Node.js 互換の JavaScript/TypeScript 実行環境と Bun のパッケージ管理機能を
# 開発コンテナ内ですぐ使える状態にするための土台を指定している。
FROM oven/bun:1.3

# Debian/Ubuntu 系のパッケージ一覧を最新化し、開発コンテナで必要な最小限の
# OS パッケージだけをインストールする。
# --no-install-recommends を付けることで、推奨パッケージまで自動で入るのを防ぎ、
# コンテナイメージのサイズ増加を抑えている。
# git はソースコード管理、curl は外部 URL からの取得、ca-certificates は HTTPS 通信、
# sudo は非 root ユーザーから管理者権限のコマンドを実行するために使う。
# 最後に apt のキャッシュとパッケージ一覧を削除して、ビルド後のイメージに
# 不要な一時ファイルが残らないようにしている。
RUN apt-get update && apt-get install -y --no-install-recommends \
  git \
  curl \
  ca-certificates \
  sudo \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# 開発作業用の非 root ユーザー vscode を作成する。
# -m でホームディレクトリ /home/vscode を作成し、-s /bin/bash で
# ログインシェルを bash に設定している。
# コンテナ内の通常作業を root ではなく一般ユーザーで行うための準備。
RUN useradd -ms /bin/bash vscode

# vscode ユーザーを sudo グループへ追加し、sudo 実行時にパスワード入力を
# 求めない設定を /etc/sudoers.d/vscode に作成する。
# devcontainer では拡張機能のセットアップや追加ツール導入で sudo が必要になる
# 場面があるため、作業ユーザーに限定して管理者権限を付与している。
# chmod 0440 は sudoers ファイルとして安全に読み込める権限に固定するための設定。
RUN usermod -aG sudo vscode \
  && echo "vscode ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/vscode \
  && chmod 0440 /etc/sudoers.d/vscode

# 以降の RUN、CMD、およびコンテナ起動時の既定ユーザーを vscode に切り替える。
# これにより、生成されるファイルの所有者が root になりにくくなり、
# ローカル環境と devcontainer 間の権限トラブルを避けやすくなる。
USER vscode

# コンテナ内でコマンドを実行する際の既定作業ディレクトリを /nano-code にする。
# devcontainer 起動後のターミナルや各種コマンドは、このディレクトリを基準に動く。
WORKDIR /nano-code

# この環境が devcontainer 内で動いていることをアプリケーションやスクリプトから
# 判定できるようにするための環境変数。
ENV DEVCONTAINER=true

# vscode ユーザーのホーム配下にある Bun の実行ファイルディレクトリを PATH の先頭に追加する。
# 追加インストールされた bun 関連コマンドを、絶対パスなしで実行できるようにしている。
ENV PATH="/home/vscode/.bun/bin:$PATH"

# Bun が依存パッケージを取得・展開するときに使うキャッシュディレクトリを
# vscode ユーザーのホーム配下へ分離する。
# root 所有のキャッシュが作られるのを避け、ユーザー権限で package install などを
# 実行したときに権限エラーが起きにくい配置にしている。
ENV BUN_INSTALL_CACHE_DIR=/home/vscode/.bun-cache

# 上で指定した Bun のキャッシュディレクトリを事前に作成する。
# この RUN は USER vscode の後に実行されるため、作成されるディレクトリは
# vscode ユーザーが利用できる所有権になる。
RUN mkdir -p $BUN_INSTALL_CACHE_DIR

# コンテナ起動時に明示的なコマンドが指定されなかった場合、bash を起動する。
# devcontainer のターミナル用途では、対話的なシェルが既定で開くようになる。
CMD ["bash"]
