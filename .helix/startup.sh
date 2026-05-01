echo "Hello"

# Install birding-3 dependencies if not already installed
if [ -d "/home/retro/work/birding-3" ]; then
  cd /home/retro/work/birding-3
  if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
    echo "Installing birding-3 dependencies..."
    npm install
  fi
fi