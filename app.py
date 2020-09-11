from flask import Flask,request,render_template
from flask_cors import CORS, cross_origin

app = Flask(__name__,static_url_path='/static')
CORS(app)
DEBUG=True

@app.route("/", methods=['GET'])
@cross_origin()
def fileFrontPage():
    print('CONSOLE PRINT')
    print( request.args)
   # try:
    selected_date = request.args.get('date', default = '*', type = str)
    selected_node = request.args.get('node', default = '*', type = str)
    print(selected_date,selected_node)
  #  except:
  #      if DEBUG:
  #          print('nope')
  #      pass
    return render_template('main.html',DATE=selected_date,NODE=selected_node )

  

if __name__ == '__main__':
    print("Voronoi Traffic Map starting...")

    #app.run(host="127.0.0.1",port=5000,debug=DEBUG)
    app.run(port=6400,debug=DEBUG)
    #app.run()


