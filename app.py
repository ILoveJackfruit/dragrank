from flask import Flask, send_from_directory

# Folder is named docs/ (not static/) because GitHub Pages can only
# serve from the repo root or a root-level docs/ folder — this way the
# exact same files run locally via Flask and online via Pages.
app = Flask(__name__, static_folder="docs", static_url_path="")


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    app.run(debug=True, port=5002)
