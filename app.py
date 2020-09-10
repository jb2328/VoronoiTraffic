from flask import Flask,render_template
from flask_cors import CORS, cross_origin

app = Flask(__name__,static_url_path='/static')
CORS(app)


@app.route("/")
@cross_origin()
def fileFrontPage():
    return render_template('main.html')


if __name__ == '__main__':
    print("Voronoi Traffic Map starting...")

    #app.run(host="127.0.0.1",port=5000,debug=DEBUG)
    #app.run(port=5000,debug=DEBUG)
    app.run()


