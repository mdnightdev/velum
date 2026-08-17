const fs = require('fs');

let code = fs.readFileSync('src/components/Lounge/ManageLoungeModal.tsx', 'utf8');

code = code.replace(
`                  {croppingIcon && (
                    <ImageCropperModal
                      imageSrc={croppingIcon.src}
                      fileName={croppingIcon.fileName}
                      aspectRatio="1:1"
                      onCancel={() => setCroppingIcon(null)}
                      onCropComplete={(croppedDataUrl, croppedFile) => {
                        setLoungeIconFile(croppedFile);
                        setEditIconUrl(croppedDataUrl);
                        setCroppingIcon(null);
                      }}
                    />
                  )}
                </div>
              </div>`,
`                  {croppingIcon && (
                    <ImageCropperModal
                      imageSrc={croppingIcon.src}
                      fileName={croppingIcon.fileName}
                      aspectRatio="1:1"
                      onCancel={() => setCroppingIcon(null)}
                      onCropComplete={(croppedDataUrl, croppedFile) => {
                        setLoungeIconFile(croppedFile);
                        setEditIconUrl(croppedDataUrl);
                        setCroppingIcon(null);
                      }}
                    />
                  )}
              </div>`
);

fs.writeFileSync('src/components/Lounge/ManageLoungeModal.tsx', code);
