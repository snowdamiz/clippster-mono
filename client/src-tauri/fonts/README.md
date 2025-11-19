# Subtitle Fonts Directory

Place your downloaded font files (.ttf or .otf) in this directory so FFmpeg can use them for subtitle rendering.

## ⚠️ IMPORTANT: Use Static Fonts, NOT Variable Fonts

**FFmpeg does NOT support variable fonts!** You must use static font files with specific weights.

- ❌ **DO NOT USE**: `Roboto-VariableFont_wght.ttf` (these won't work!)
- ✅ **USE THESE**: `Roboto-Regular.ttf`, `Roboto-Bold.ttf` (static fonts)

## How to Download the Correct Fonts from Google Fonts

When downloading from Google Fonts, you'll see TWO options:
1. **"Download family"** button - this gives you variable fonts (DON'T USE)
2. **"Get font"** then select individual weights - this is what you need!

### Step-by-Step for Each Font:

1. Go to [Google Fonts](https://fonts.google.com/)
2. Search for the font (e.g., "Roboto")
3. Click "Get font"
4. In the sidebar, click "Select styles" or expand the font
5. **Select these weights individually**:
   - ✅ Regular 400
   - ✅ Bold 700
6. Click the download icon (top right)
7. Extract the zip file
8. **Look inside the `static/` folder** - this has the static fonts!
9. Copy the files to this directory

## Required Font Files

### **Montserrat**
- `Montserrat-Regular.ttf` (from static folder)
- `Montserrat-Bold.ttf` (from static folder)

### **Roboto**
- `Roboto-Regular.ttf` (from static folder)
- `Roboto-Bold.ttf` (from static folder)

### **Inter**
- `Inter-Regular.ttf` (from static folder)
- `Inter-Bold.ttf` (from static folder)

### **Poppins**
- `Poppins-Regular.ttf` (from static folder)
- `Poppins-Bold.ttf` (from static folder)

### **Open Sans**
- `OpenSans-Regular.ttf` (from static folder)
- `OpenSans-Bold.ttf` (from static folder)

### **Bebas Neue**
- `BebasNeue-Regular.ttf`

## Quick Fix for Current Issue

1. **Delete these files** (variable fonts won't work):
   - `Roboto-VariableFont_wdth,wght.ttf`
   - `Roboto-Italic-VariableFont_wdth,wght.ttf`
   - `Montserrat-VariableFont_wght.ttf`
   - `Montserrat-Italic-VariableFont_wght.ttf`

2. **Download the correct static fonts** (see instructions above)

3. **Place them in this directory** - they should be named like:
   - `Roboto-Regular.ttf`
   - `Roboto-Bold.ttf`
   - etc.

## Notes

- Font files must be .ttf (TrueType) format
- Use files from the `static/` folder in the Google Fonts download
- Variable fonts (VariableFont_wght) will NOT work with FFmpeg
- After adding/changing fonts, rebuild the application

