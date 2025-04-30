from flask import Flask, request, jsonify
from router.customs_router import customs_router

app = Flask(__name__)

@app.route("/api/customs/ask", methods=["POST"])
def ask_customs():
    data = request.get_json()
    message = data.get("message", "")
    result = customs_router(message)
    return jsonify(result)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
