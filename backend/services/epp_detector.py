import os
import numpy as np
import cv2
import onnxruntime as ort

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "epp_model.onnx")

CLASS_NAMES = {
    0: "Hardhat",
    1: "Mask",
    2: "NO-Hardhat",
    3: "NO-Mask",
    4: "NO-Safety Vest",
    5: "Person",
    6: "Safety Cone",
    7: "Safety Vest",
    8: "machinery",
    9: "vehicle",
}

HARDHAT_CLASSES = {"Hardhat"}
MASK_CLASSES = {"Mask"}

CONF_THRESHOLD = 0.4
INPUT_SIZE = 640

_session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
_input_name = _session.get_inputs()[0].name


def _preprocess(img):
    resized = cv2.resize(img, (INPUT_SIZE, INPUT_SIZE))
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    normalized = rgb.astype(np.float32) / 255.0
    chw = np.transpose(normalized, (2, 0, 1))
    return np.expand_dims(chw, axis=0)


def detect_epp(image_bytes: bytes):
    np_arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    input_tensor = _preprocess(img)
    outputs = _session.run(None, {_input_name: input_tensor})[0]  # (1, 14, 8400)

    # outputs[0] -> (14, 8400): filas 0-3 = bbox, filas 4-13 = score por clase
    class_scores = outputs[0][4:14, :]  # (10, 8400)
    best_class = np.argmax(class_scores, axis=0)      # (8400,)
    best_conf = np.max(class_scores, axis=0)           # (8400,)

    detected_classes = set()
    for cls_idx, conf in zip(best_class, best_conf):
        if conf >= CONF_THRESHOLD:
            detected_classes.add(CLASS_NAMES[int(cls_idx)])

    helmet_detected = bool(detected_classes & HARDHAT_CLASSES)
    mask_detected = bool(detected_classes & MASK_CLASSES)

    status = "COMPLIANT" if helmet_detected and mask_detected else "NON_COMPLIANT"

    return {
        "helmet_detected": helmet_detected,
        "mask_detected": mask_detected,
        "status": status,
    }