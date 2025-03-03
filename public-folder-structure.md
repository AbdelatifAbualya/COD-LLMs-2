# Public Folder Structure

The `public` folder contains all the frontend assets for the Enhanced LLM Playground application. This document explains the structure and provides guidance for customization.

## Structure

```
public/
└── index.html     # The main application HTML file
```

The application is designed as a single HTML file to simplify deployment. All CSS and JavaScript are contained within the index.html file.

## Customization

### Changing the Application Title

To change the application title:

1. Open `public/index.html`
2. Find the `<title>` tag and modify it:
   ```html
   <title>Your New Title</title>
   ```
3. Also update the header in the HTML body:
   ```html
   <h1 id="pageTitle">Your New Title</h1>
   ```

### Adding a Logo

To add a logo:

1. Create an image file (recommended size: 180x40px)
2. Add it to the public folder
3. Update the header in `index.html`:
   ```html
   <div class="chat-header">
     <div class="header-left">
       <img src="your-logo.png" alt="Logo" class="header-logo">
       <h1 id="pageTitle">Enhanced LLM Playground</h1>
     </div>
     <!-- Rest of header -->
   </div>
   ```
4. Add appropriate CSS for positioning

### Customizing Theme Colors

The application uses a dark theme by default. To change theme colors:

1. Open `index.html`
2. Find the CSS section at the top of the file
3. Update the following primary color variables:
   ```css
   body {
     background: linear-gradient(145deg, #YOUR_COLOR1 0%, #YOUR_COLOR2 100%);
   }
   ```

### Adding Custom CSS

You can add custom CSS directly in the `<style>` section of `index.html`:

```html
<style>
  /* Existing styles */
  
  /* Your custom styles */
  .your-custom-class {
    color: red;
  }
</style>
```

## Advanced Customization

For more advanced customizations:

1. Extract the styles into a separate CSS file
2. Add the file to the public folder
3. Link to it in the `<head>` section of index.html:
   ```html
   <link rel="stylesheet" href="your-styles.css">
   ```

The same approach can be used to extract JavaScript into separate files if needed.
