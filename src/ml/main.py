import pickle
from transformers import AutoTokenizer, AutoModelForCausalLM

from flask import Flask, request, jsonify

with open('./save/tokenizer.pkl', 'rb') as f:
    tokenizer = pickle.load(f)

with open('./save/model.pkl', 'rb') as f:
    model = pickle.load(f)

app = Flask(__name__)

def generate(query):
    # Encode user query
    new_user_input_ids = tokenizer.encode(query + tokenizer.eos_token, return_tensors='pt')

    # Generate a response
    chat_output = model.generate(new_user_input_ids, max_length=1000, pad_token_id=tokenizer.eos_token_id)

    # Extract and decode the output (i.e., the generated response)
    response = tokenizer.decode(chat_output[:, new_user_input_ids.shape[-1]:][0], skip_special_tokens=True)

    return response

@app.route('/modmail', methods=['POST'])
def modmail():
    data = request.json
    modmail_content = data.get('modmail', None)
    print(modmail_content, type(modmail_content))
    if modmail_content:
        response = generate(modmail_content)
        print(response)
        return jsonify({"response": response})
    else:
        print("No 'modmail' key in POST data.")
        return jsonify({"response": "No 'modmail' key in POST data."})


if __name__ == '__main__':
    app.run(port=5000)