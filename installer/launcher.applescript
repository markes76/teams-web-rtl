-- Runs in the user's Chrome profile. No embedded browser or copied credentials.
on run
  set userHome to POSIX path of (path to home folder)
  set managedTeams to userHome & "Applications/Chrome Apps.localized/Microsoft Teams (PWA).app"
  try
    do shell script "/bin/test -d " & quoted form of managedTeams
    do shell script "/usr/bin/open " & quoted form of managedTeams
    return
  end try
  set chromeBinary to "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  try
    do shell script "/bin/test -x " & quoted form of chromeBinary
  on error
    set chromeBinary to userHome & "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    try
      do shell script "/bin/test -x " & quoted form of chromeBinary
    on error
      display dialog "Install Google Chrome, then open teams-web again." buttons {"OK"} default button "OK"
      return
    end try
  end try
  do shell script quoted form of chromeBinary & " --app=https://teams.cloud.microsoft/ >/dev/null 2>&1 &"
end run
