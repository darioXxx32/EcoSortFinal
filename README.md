# EcoSort

EcoSort is a multimodal AI mobile application that helps users decide what to do with everyday waste. The user provides two inputs: a photo of the item and a short text description. The system combines visual recognition, text understanding, and semantic rules to recommend a practical action such as recycle, clean first, donate, compost, discard safely, or take the item to a special collection point.

## Why It Matters

Many recycling mistakes happen because people are unsure what to do at the exact moment they are holding an item. A clean bottle, a chemical container, a greasy cardboard box, a battery, and food leftovers should not receive the same recommendation. EcoSort focuses on turning that moment of doubt into a clear environmental action.

## Main Features

- Multimodal input: image + user description.
- Neural network pipeline for waste classification.
- Semantic context layer for real disposal guidance.
- Mobile interface built with Expo and React Native.
- FastAPI backend for model inference.
- Recommendations adapted to the detected item and context.
- Educational actions, tips, and user-friendly explanations.

## Multimodal AI Design

EcoSort uses two synchronized modalities:

- Image: the app analyzes the visual appearance of the waste item.
- Text: the app reads a short user description, such as whether the item is clean, greasy, sanitary, chemical, old, reusable, or organic.

The model fuses both signals to improve the final decision. This is important because the same visible object can require different actions depending on context. For example, a clean bottle may be recyclable, while a bottle with chemical residue should be treated as special waste.

## Project Structure

```text
backend/              FastAPI inference service
mobile/               Expo React Native application
ml/                   Training and model utilities
data/metadata/        Class and object metadata
scripts/              Setup, training, and launch scripts
presentacion/         Shark Tank presentation source and PDF
docs/pitch/           Pitch script for the final presentation
```

Large artifacts such as datasets, trained model files, virtual environments, build outputs, and generated reports are intentionally excluded from version control.

## Requirements

- Python 3.10 or newer
- Node.js and npm
- Expo Go or an Android device/emulator
- PowerShell on Windows for the provided helper scripts

## Quick Start

### 1. Install backend dependencies

```powershell
.\scripts\setup_backend.ps1
```

### 2. Start the API

```powershell
.\scripts\start_api.ps1
```

The API listens on port `8000`. The script prints the local network URLs that can be used from a phone.

To verify the API, open:

```text
http://<your-local-ip>:8000/health
```

### 3. Start the mobile app

Open a second terminal and run:

```powershell
.\scripts\start_mobile.ps1
```

Then open the app with Expo Go or an Android build.

## Model Artifacts

The trained `.keras` model is not stored in the repository because it is a heavy generated artifact. To run the full neural inference mode, place the trained model in the expected model artifact directory or train it again using the project scripts.

If the model artifact is missing, the backend can still run in a reduced semantic mode, but the complete project is intended to use the multimodal neural network.

## Training

The repository includes helper scripts for preparing data and training the model:

```powershell
.\scripts\prepare_data.ps1
.\scripts\train_keras.ps1
```

Additional resume scripts are included for longer training runs.

## Final Deliverables

- Functional Android mobile app.
- FastAPI backend connected to the multimodal model.
- IEEE-style technical report.
- Shark Tank-style pitch presentation.
- Multimodal validation examples for image + text behavior.

## Pitch

The final presentation script is available at:

```text
docs/pitch/shark_tank_pitch.md
```

The pitch explains the problem, target users, solution, demo flow, neural network approach, results, value proposition, and closing statement.

## License

This project was developed for academic purposes as part of a Neural Networks and Deep Learning course.

