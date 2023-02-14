rdctl shell $CMD
apk add open-iscsi

kubectl apply -f https://raw.githubusercontent.com/longhorn/longhorn/v1.4.0/deploy/longhorn.yaml

kubectl delete -f https://raw.githubusercontent.com/longhorn/longhorn/v1.4.0/deploy/longhorn.yaml

kubectl delete -f https://raw.githubusercontent.com/longhorn/longhorn/v1.4.0/uninstall/uninstall.yaml